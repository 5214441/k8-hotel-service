(function(){
  const config=window.HOTEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const api=String(config.apiBase||"").replace(/\/$/,"");
  const services=[
    ["客房用品","水、纸巾、牙具等"],["打扫房间","清洁或补充用品"],["更换布草","毛巾、床单、被套"],
    ["设备报修","空调、电视、热水等"],["续住咨询","续住与房价确认"],["退房咨询","退房时间或寄存"],
    ["开票咨询","电子发票或抬头"],["租车服务","经济/商务/SUV/七座"],["其他需求","请在下方说明"]
  ];
  let selected=new Set(),tracking=null,trackingTimer=null,lastStatus="";
  const apiReady=()=>/^https:\/\/.+/.test(api)&&!api.includes("请替换");
  const params=()=>new URLSearchParams(location.search);
  const queryRoom=()=>params().get("room")||"";
  const storageKey=room=>"k8_active_ticket_"+room;
  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.add("hidden"),1900)}
  function render(){
    document.title=(config.hotelName||"酒店")+" · 住客服务";
    $("hotelName").textContent=config.hotelName||"酒店";
    const room=queryRoom();$("roomNo").textContent=room||"未识别";$("roomInput").value=room;
    $("hotelAddress").textContent=config.address||"请咨询前台";
    $("wifiText").textContent=config.wifiText||"请咨询前台";
    $("checkoutText").textContent=config.checkOutText||"请咨询前台";
    services.forEach(([name,desc])=>{
      const b=document.createElement("button");b.className="service-chip";b.type="button";
      b.innerHTML="<b>"+name+"</b><small>"+desc+"</small>";
      b.onclick=()=>{selected.has(name)?selected.delete(name):selected.add(name);b.classList.toggle("selected",selected.has(name))};
      $("serviceGrid").appendChild(b);
    });
    (config.rentalPrices||[]).forEach(x=>{
      const d=document.createElement("div");d.className="rental-card";
      d.innerHTML="<b>"+x.name+"</b><strong>"+x.price+"</strong><small>"+x.note+"</small>";
      d.onclick=()=>{selected.add("租车服务-"+x.name+" "+x.price);toast("已选择 "+x.name)};
      $("rentalGrid").appendChild(d);
    });
    if(!apiReady())$("apiWarning").classList.remove("hidden");
    restoreTracking();
  }
  function restoreTracking(){
    const p=params(),room=queryRoom();
    const fromUrl=p.get("ticket")&&p.get("track")?{id:p.get("ticket"),token:p.get("track"),room}:null;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey(room))||"null")}catch(e){}
    tracking=fromUrl||saved;
    if(tracking&&tracking.id&&tracking.token){showTracking();pollStatus(true)}
  }
  function saveTracking(t){
    tracking=t;localStorage.setItem(storageKey(t.room),JSON.stringify(t));
    const p=params();p.set("room",t.room);p.set("ticket",t.id);p.set("track",t.token);
    history.replaceState(null,"",location.pathname+"?"+p.toString());
  }
  function clearTracking(){
    if(tracking&&tracking.room)localStorage.removeItem(storageKey(tracking.room));
    tracking=null;lastStatus="";clearInterval(trackingTimer);trackingTimer=null;
    $("activeTicketPanel").classList.add("hidden");$("requestForm").classList.remove("hidden");
    const p=params();p.delete("ticket");p.delete("track");history.replaceState(null,"",location.pathname+"?"+p.toString());
    resetForm();scrollTo({top:0,behavior:"smooth"});
  }
  function resetForm(){selected.clear();document.querySelectorAll(".service-chip.selected").forEach(x=>x.classList.remove("selected"));$("remark").value="";$("guestName").value="";$("submitRequest").disabled=false;$("submitRequest").textContent="立即提交给前台"}
  function showTracking(){
    $("requestForm").classList.add("hidden");$("activeTicketPanel").classList.remove("hidden");$("trackingTicketId").textContent=tracking.id;
    clearInterval(trackingTimer);trackingTimer=setInterval(()=>pollStatus(true),(config.pollSeconds||4)*1000);
  }
  function setSteps(status){
    ["stepSubmitted","stepAccepted","stepProcessing","stepCompleted"].forEach(id=>$(id).classList.remove("active"));
    $("stepSubmitted").classList.add("active");
    if(["accepted","completed"].includes(status)){$("stepAccepted").classList.add("active");$("stepProcessing").classList.add("active")}
    if(status==="completed")$("stepCompleted").classList.add("active");
  }
  function updateTrackingView(t){
    const map={
      new:{label:"已提交",cls:"status-new",title:"前台正在查看您的需求",msg:"请稍候，前台接单后这里会自动更新。"},
      accepted:{label:"前台已接单",cls:"status-accepted",title:(t.accepted_by||"前台")+"正在处理",msg:"工作人员已经收到并开始安排，请您稍候。"},
      completed:{label:"已完成",cls:"status-completed",title:"您的需求已处理完成",msg:"感谢您的耐心等待。仍有需要可继续提交新需求。"},
      cancelled:{label:"已取消",cls:"status-cancelled",title:"该服务单已取消",msg:"有需要请重新提交或直接联系前台。"}
    };
    const s=map[t.status]||map.new,b=$("trackingStatus");b.className="status-badge "+s.cls;b.textContent=s.label;
    $("trackingTitle").textContent=s.title;$("trackingMessage").textContent=s.msg;$("trackingTicketId").textContent=t.id;setSteps(t.status);
    if(t.staff_reply){$("staffReplyBox").classList.remove("hidden");$("staffReply").textContent=t.staff_reply;$("etaText").textContent=t.eta_minutes?("预计约 "+t.eta_minutes+" 分钟内处理"):""}else $("staffReplyBox").classList.add("hidden");
    $("closeTracking").classList.toggle("hidden",!["completed","cancelled"].includes(t.status));
    $("trackingSync").textContent="更新于 "+new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
    if(lastStatus&&lastStatus!==t.status)toast(t.status==="accepted"?"前台已接单":t.status==="completed"?"服务已完成":"进度已更新");lastStatus=t.status;
  }
  async function pollStatus(silent=false){
    if(!tracking||!apiReady())return;
    try{
      const res=await fetch(api+"/api/tickets/"+encodeURIComponent(tracking.id)+"/status?token="+encodeURIComponent(tracking.token),{cache:"no-store"});
      const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||"查询进度失败");updateTrackingView(data.ticket);
    }catch(e){$("trackingSync").textContent="暂时无法更新";if(!silent)toast(e.message||"查询失败")}
  }
  async function submit(){
    const room=$("roomInput").value.trim().replace(/[^\w\u4e00-\u9fa5-]/g,"");const remark=$("remark").value.trim();
    if(!room){toast("请填写房间号");$("roomInput").focus();return}if(!selected.size&&!remark){toast("请选择服务或填写需求");return}if(!apiReady()){toast("系统尚未连接前台");return}
    const btn=$("submitRequest");btn.disabled=true;btn.textContent="正在通知前台…";
    try{
      const res=await fetch(api+"/api/tickets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({room,services:[...selected],remark,guestName:$("guestName").value.trim()})});
      const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||"提交失败");
      saveTracking({id:data.ticket.id,token:data.ticket.guest_token,room});showTracking();updateTrackingView(data.ticket);$("activeTicketPanel").scrollIntoView({behavior:"smooth",block:"start"});btn.textContent="已提交";
    }catch(e){toast(e.message||"网络异常，请稍后重试");btn.disabled=false;btn.textContent="立即提交给前台"}
  }
  $("submitRequest").onclick=submit;$("refreshStatus").onclick=()=>pollStatus(false);$("closeTracking").onclick=clearTracking;render();
})();
