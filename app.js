(function(){
  const config=window.HOTEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const api=String(config.apiBase||"").replace(/\/$/,"");
  const services=[
    ["客房用品","水、纸巾、牙具等"],["打扫房间","清洁或补充用品"],["更换布草","毛巾、床单、被套"],
    ["设备报修","空调、电视、热水等"],["续住咨询","续住与房价确认"],["退房咨询","退房时间或寄存"],
    ["开票咨询","电子发票或抬头"],["租车服务","经济/商务/SUV/七座"],["其他需求","请在下方说明"]
  ];

  let selected=new Set();
  let tracking=null;
  let trackingTimer=null;
  let countdownTimer=null;
  let currentTicket=null;
  let lastStatus="";
  let selectedRating="";

  const params=()=>new URLSearchParams(location.search);
  const room=()=>params().get("room")||"";
  const roomKey=()=>params().get("key")||"";
  const apiReady=()=>/^https:\/\/.+/.test(api)&&!api.includes("请替换");
  const storageKey=()=>`k8_v5_ticket_${room()}`;

  function toast(msg){
    const el=$("toast");
    el.textContent=msg;
    el.classList.remove("hidden");
    clearTimeout(window.__toast);
    window.__toast=setTimeout(()=>el.classList.add("hidden"),2400);
  }

  function formatTime(value){
    if(!value)return "—";
    return new Date(value).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
  }

  function render(){
    document.title=(config.hotelName||"酒店")+" · 住客服务";
    $("roomNo").textContent=room()||"未识别";
    $("roomInput").value=room();
    $("hotelAddress").textContent=config.address||"请咨询前台";
    $("wifiText").textContent=config.wifiText||"请咨询前台";
    $("checkoutText").textContent=config.checkOutText||"请咨询前台";

    if(config.frontDeskPhone){
      $("phoneBox").classList.remove("hidden");
      $("phoneLink").href="tel:"+config.frontDeskPhone;
      $("phoneLink").textContent="紧急需求请拨打前台："+config.frontDeskPhone;
    }

    services.forEach(([name,desc])=>{
      const button=document.createElement("button");
      button.className="service-chip";
      button.type="button";
      button.innerHTML=`<b>${name}</b><small>${desc}</small>`;
      button.onclick=()=>{
        selected.has(name)?selected.delete(name):selected.add(name);
        button.classList.toggle("selected",selected.has(name));
      };
      $("serviceGrid").appendChild(button);
    });

    (config.rentalPrices||[]).forEach(item=>{
      const card=document.createElement("div");
      card.className="rental-card";
      card.innerHTML=`<b>${item.name}</b><strong>${item.price}</strong><small>${item.note}</small>`;
      card.onclick=()=>{
        selected.add(`租车服务-${item.name} ${item.price}`);
        toast("已选择 "+item.name);
      };
      $("rentalGrid").appendChild(card);
    });

    if(!apiReady())$("apiWarning").classList.remove("hidden");
    if(!room()||!roomKey()){
      $("invalidQr").classList.remove("hidden");
      $("submitRequest").disabled=true;
    }else{
      restoreTracking();
    }

    updateNetwork();
  }

  function updateNetwork(){
    $("offlineBanner").classList.toggle("hidden",navigator.onLine);
  }

  function saveTracking(value){
    tracking=value;
    localStorage.setItem(storageKey(),JSON.stringify(value));
    const p=params();
    p.set("room",room());
    p.set("key",roomKey());
    p.set("ticket",value.id);
    p.set("track",value.token);
    history.replaceState(null,"",location.pathname+"?"+p.toString());
  }

  function restoreTracking(){
    const p=params();
    const fromUrl=p.get("ticket")&&p.get("track")
      ?{id:p.get("ticket"),token:p.get("track")}
      :null;
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(storageKey())||"null")}catch{}
    tracking=fromUrl||saved;

    if(tracking?.id&&tracking?.token){
      showTracking();
      pollStatus(true);
      return;
    }
    restoreActive();
  }

  async function restoreActive(){
    try{
      const res=await fetch(`${api}/api/rooms/${encodeURIComponent(room())}/active?key=${encodeURIComponent(roomKey())}`,{cache:"no-store"});
      if(res.status===404)return;
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"恢复工单失败");
      const t=data.ticket;
      saveTracking({id:t.id,token:t.guest_token});
      showTracking();
      updateTracking(t);
    }catch(error){
      if(error.message.includes("二维码")){
        $("invalidQr").classList.remove("hidden");
        $("submitRequest").disabled=true;
      }
    }
  }

  function showTracking(){
    $("requestForm").classList.add("hidden");
    $("activeTicketPanel").classList.remove("hidden");
    $("trackingTicketId").textContent=tracking.id;
    clearInterval(trackingTimer);
    trackingTimer=setInterval(()=>pollStatus(true),(config.pollSeconds||4)*1000);
  }

  function setSteps(status){
    ["stepSubmitted","stepAccepted","stepProcessing","stepCompleted"].forEach(id=>$(id).classList.remove("active"));
    $("stepSubmitted").classList.add("active");
    if(["accepted","completed"].includes(status)){
      $("stepAccepted").classList.add("active");
      $("stepProcessing").classList.add("active");
    }
    if(status==="completed")$("stepCompleted").classList.add("active");
  }

  function startCountdown(ticket){
    clearInterval(countdownTimer);
    const renderCountdown=()=>{
      if(!ticket.eta_deadline){
        $("etaText").textContent=ticket.eta_minutes?`预计约 ${ticket.eta_minutes} 分钟内处理`:"";
        $("etaText").classList.remove("eta-overdue");
        return;
      }
      const remain=Math.ceil((new Date(ticket.eta_deadline).getTime()-Date.now())/60000);
      if(remain>0){
        $("etaText").textContent=`预计约 ${ticket.eta_minutes||remain} 分钟内处理 · 剩余约 ${remain} 分钟`;
        $("etaText").classList.remove("eta-overdue");
      }else{
        $("etaText").textContent="预计时间已到，前台正在继续处理";
        $("etaText").classList.add("eta-overdue");
      }
    };
    renderCountdown();
    countdownTimer=setInterval(renderCountdown,30000);
  }

  function updateTracking(t){
    currentTicket=t;
    const map={
      new:{label:"已提交",cls:"status-new",title:"前台正在查看您的需求",msg:"请稍候，前台接单后这里会自动更新。"},
      accepted:{label:"前台已接单",cls:"status-accepted",title:"前台正在处理",msg:"工作人员已经收到并开始安排。"},
      completed:{label:"已完成",cls:"status-completed",title:"前台已标记处理完成",msg:"请确认本次需求是否已经解决。"},
      cancelled:{label:"已取消",cls:"status-cancelled",title:"该服务单已取消",msg:"仍有需要请重新提交或直接联系前台。"}
    };
    const state=map[t.status]||map.new;
    const badge=$("trackingStatus");
    badge.className="status-badge "+state.cls;
    badge.textContent=state.label;
    $("trackingTitle").textContent=state.title;
    $("trackingMessage").textContent=state.msg;
    $("trackingTicketId").textContent=t.id;
    $("detailServices").textContent=(t.services||[]).join("、")||"其他需求";
    $("detailRemark").textContent=t.remark||"无";
    $("detailCreated").textContent=formatTime(t.created_at);
    setSteps(t.status);

    if(t.staff_reply){
      $("staffReplyBox").classList.remove("hidden");
      $("staffReply").textContent=t.staff_reply;
      startCountdown(t);
    }else{
      $("staffReplyBox").classList.add("hidden");
      clearInterval(countdownTimer);
    }

    const needsResolution=t.status==="completed"&&t.guest_resolution!=="resolved";
    $("resolutionBox").classList.toggle("hidden",!needsResolution);

    const canRate=t.status==="completed"&&t.guest_resolution==="resolved";
    $("ratingBox").classList.toggle("hidden",!canRate);
    if(canRate){
      if(t.rating){
        const labels={satisfied:"满意",average:"一般",unsatisfied:"不满意"};
        $("ratingChoices").classList.add("hidden");
        $("ratingComment").classList.add("hidden");
        $("submitRating").classList.add("hidden");
        $("ratingDone").classList.remove("hidden");
        $("ratingDone").textContent=`评价已提交：${labels[t.rating]||t.rating}${t.rating_comment?"；"+t.rating_comment:""}`;
      }else{
        $("ratingChoices").classList.remove("hidden");
        $("ratingComment").classList.remove("hidden");
        $("submitRating").classList.remove("hidden");
        $("ratingDone").classList.add("hidden");
      }
    }

    $("remindBtn").classList.toggle("hidden",!["new","accepted"].includes(t.status));
    $("closeTracking").classList.toggle("hidden",!["completed","cancelled"].includes(t.status));
    $("trackingSync").textContent="更新于 "+new Date().toLocaleTimeString("zh-CN",{hour12:false});

    if(lastStatus&&lastStatus!==t.status){
      toast(t.status==="accepted"?"前台已接单":t.status==="completed"?"服务已完成":"进度已更新");
    }
    lastStatus=t.status;
  }

  async function pollStatus(silent=false){
    if(!tracking||!apiReady())return;
    try{
      const res=await fetch(`${api}/api/tickets/${encodeURIComponent(tracking.id)}/status?token=${encodeURIComponent(tracking.token)}`,{cache:"no-store"});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"查询进度失败");
      updateTracking(data.ticket);
    }catch(error){
      $("trackingSync").textContent="暂时无法更新";
      if(!silent)toast(error.message||"查询失败");
    }
  }

  async function submit(){
    const remark=$("remark").value.trim();
    if(!selected.size&&!remark){toast("请选择服务或填写需求");return}
    if(!apiReady()){toast("系统尚未连接前台");return}
    if(!room()||!roomKey()){toast("请重新扫描房间二维码");return}

    const btn=$("submitRequest");
    btn.disabled=true;
    btn.textContent="正在通知前台…";

    try{
      const res=await fetch(api+"/api/tickets",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          room:room(),
          roomKey:roomKey(),
          services:[...selected],
          remark,
          guestName:$("guestName").value.trim()
        })
      });
      const data=await res.json().catch(()=>({}));
      if(res.status===409&&data.code==="ACTIVE_EXISTS"&&data.ticket){
        saveTracking({id:data.ticket.id,token:data.ticket.guest_token});
        showTracking();
        updateTracking(data.ticket);
        toast("本房间已有未完成工单，已打开当前进度");
        return;
      }
      if(!res.ok)throw new Error(data.message||"提交失败");
      saveTracking({id:data.ticket.id,token:data.ticket.guest_token});
      showTracking();
      updateTracking(data.ticket);
      $("activeTicketPanel").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){
      toast(error.message||"网络异常，请稍后重试");
      btn.disabled=false;
      btn.textContent="立即提交给前台";
    }
  }

  async function guestAction(action,extra={}){
    if(!tracking)return;
    try{
      const res=await fetch(`${api}/api/tickets/${encodeURIComponent(tracking.id)}/guest`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token:tracking.token,action,...extra})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"操作失败");
      toast(
        action==="remind"?"已提醒前台":
        action==="resolved"?"感谢您的确认，请评价本次服务":
        action==="rate"?"感谢您的评价":
        "已重新通知前台继续处理"
      );
      await pollStatus(true);
    }catch(error){
      toast(error.message||"操作失败");
    }
  }

  function closeTracking(){
    localStorage.removeItem(storageKey());
    tracking=null;
    currentTicket=null;
    lastStatus="";
    clearInterval(trackingTimer);
    clearInterval(countdownTimer);
    $("activeTicketPanel").classList.add("hidden");
    $("requestForm").classList.remove("hidden");
    const p=params();
    p.delete("ticket");p.delete("track");
    history.replaceState(null,"",location.pathname+"?"+p.toString());
    selected.clear();
    document.querySelectorAll(".service-chip.selected").forEach(x=>x.classList.remove("selected"));
    $("remark").value="";
    $("guestName").value="";
    $("submitRequest").disabled=false;
    $("submitRequest").textContent="立即提交给前台";
    scrollTo({top:0,behavior:"smooth"});
  }

  document.querySelectorAll("#ratingChoices button").forEach(button=>{
    button.onclick=()=>{
      selectedRating=button.dataset.rating;
      document.querySelectorAll("#ratingChoices button").forEach(x=>x.classList.toggle("selected",x===button));
    };
  });
  $("submitRating").onclick=()=>{
    if(!selectedRating){toast("请选择满意、一般或不满意");return}
    guestAction("rate",{rating:selectedRating,comment:$("ratingComment").value.trim()});
  };

  $("submitRequest").onclick=submit;
  $("refreshStatus").onclick=()=>pollStatus(false);
  $("remindBtn").onclick=()=>guestAction("remind");
  $("resolvedBtn").onclick=()=>guestAction("resolved");
  $("unresolvedBtn").onclick=()=>guestAction("unresolved");
  $("closeTracking").onclick=closeTracking;
  window.addEventListener("online",()=>{updateNetwork();pollStatus(true)});
  window.addEventListener("offline",updateNetwork);
  render();
})();
