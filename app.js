(function(){
  const config=window.HOTEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const services=[
    ["客房用品","水、纸巾、牙具等"],["打扫房间","清洁或补充用品"],["更换布草","毛巾、床单、被套"],
    ["设备报修","空调、电视、热水等"],["续住咨询","续住与房价确认"],["退房咨询","退房时间或寄存"],
    ["开票咨询","电子发票或抬头"],["租车服务","经济/商务/SUV/七座"],["其他需求","请在下方说明"]
  ];
  let selected=new Set();
  const apiReady=()=>/^https:\/\/.+/.test(config.apiBase||"")&&!String(config.apiBase).includes("请替换");
  const queryRoom=()=>new URLSearchParams(location.search).get("room")||"";
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
  }
  async function submit(){
    const room=$("roomInput").value.trim().replace(/[^\w\u4e00-\u9fa5-]/g,"");
    const remark=$("remark").value.trim();
    if(!room){toast("请填写房间号");$("roomInput").focus();return}
    if(!selected.size&&!remark){toast("请选择服务或填写需求");return}
    if(!apiReady()){toast("系统尚未连接前台");return}
    const btn=$("submitRequest");btn.disabled=true;btn.textContent="正在通知前台…";
    try{
      const res=await fetch(config.apiBase.replace(/\/$/,"")+"/api/tickets",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({room,services:[...selected],remark,guestName:$("guestName").value.trim()})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.message||"提交失败");
      $("ticketId").textContent=data.ticket.id;
      $("successSummary").textContent=room+"房 · "+([...selected].join("、")||remark);
      $("successPanel").classList.remove("hidden");
      $("successPanel").scrollIntoView({behavior:"smooth",block:"center"});
      btn.textContent="已提交";
    }catch(e){toast(e.message||"网络异常，请稍后重试");btn.disabled=false;btn.textContent="立即提交给前台"}
  }
  $("submitRequest").onclick=submit;
  $("newRequest").onclick=()=>{selected.clear();document.querySelectorAll(".service-chip.selected").forEach(x=>x.classList.remove("selected"));$("remark").value="";$("successPanel").classList.add("hidden");$("submitRequest").disabled=false;$("submitRequest").textContent="立即提交给前台";scrollTo({top:0,behavior:"smooth"})};
  render();
})();