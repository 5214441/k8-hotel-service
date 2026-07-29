(function(){
  const $=id=>document.getElementById(id);
  const config=window.HOTEL_CONFIG||{};
  const api=String(config.apiBase||"").replace(/\/$/,"");

  function toast(message){const el=$("toast");el.textContent=message;el.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.add("hidden"),2400)}
  function rooms(){return [...new Set($("rooms").value.split(/[\s,，、;；]+/).map(x=>x.trim()).filter(Boolean).slice(0,300))]}
  function createText(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=text;return el}
  function logo(src,cls){const img=document.createElement("img");img.src=src;img.className=cls||"";return img}

  async function getKeys(roomList){
    const password=$("adminPassword").value;
    if(!password)throw new Error("请输入管理密码");
    const res=await fetch(api+"/api/rooms/keys",{method:"POST",headers:{"Content-Type":"application/json","X-Admin-Password":password},body:JSON.stringify({rooms:roomList,rotate:$("rotateKeys").checked})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||"生成房间密钥失败");
    sessionStorage.setItem("k8_qr_admin_password",password);
    return data.rooms||[];
  }

  function roomUrl(room,key){
    const url=new URL($("baseUrl").value.trim(),location.href);
    url.search="";
    url.hash="";
    url.searchParams.set("room",room);
    url.searchParams.set("key",key);
    return url.toString();
  }

  function card(room,url,theme,title){
    const article=document.createElement("article");article.className="room-card theme-"+theme;
    const top=document.createElement("div");top.className="card-top";
    const brand=document.createElement("div");brand.className="brand-lockup";
    brand.append(logo("assets/k8-hotel-logo-white.png","card-brand-logo logo-light"),logo("assets/k8-hotel-logo-dark.png","card-brand-logo logo-dark"));
    top.append(brand,createText("div","room-tag","SECURE ROOM SERVICE"));
    const main=document.createElement("div");main.className="room-main";main.append(createText("div","room-label","ROOM NUMBER"),createText("div","room-number",room),createText("div","card-title",title));
    const shell=document.createElement("div");shell.className="qr-shell";const qr=document.createElement("div");qr.className="qr";shell.appendChild(qr);
    const center=document.createElement("div");center.className="qr-logo";center.appendChild(logo("assets/k8-hotel-symbol-dark.png",""));shell.appendChild(center);
    const scan=createText("div","scan-line","微信扫一扫");
    const pills=document.createElement("div");pills.className="service-pills";["客房用品","清洁服务","设备报修","前台咨询"].forEach(x=>pills.appendChild(createText("span","",x)));
    const bottom=document.createElement("div");bottom.className="card-bottom";bottom.append(createText("b","","需求直达前台 · 进度实时查看"),createText("small","","每房专属安全二维码，请勿拍照外传"));
    article.append(top,main,shell,scan,pills,bottom);
    new QRCode(qr,{text:url,width:232,height:232,colorDark:"#111111",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});
    return article;
  }

  async function generate(){
    if(typeof QRCode==="undefined"){toast("二维码组件未加载，请检查网络");return}
    const list=rooms();if(!list.length){toast("请先输入房号");return}
    if(!api){toast("config.js 未设置API地址");return}
    const button=$("generate");button.disabled=true;button.textContent="正在生成密钥…";
    try{
      const keys=await getKeys(list),root=$("cards");root.innerHTML="";
      keys.forEach(item=>root.appendChild(card(item.room,roomUrl(item.room,item.key),$("theme").value,$("cardTitle").value.trim()||"专属住客服务")));
      $("emptyState").classList.add("hidden");
      toast(`已生成 ${keys.length} 个安全二维码`);
      root.scrollIntoView({behavior:"smooth"});
    }catch(e){toast(e.message)}finally{button.disabled=false;button.textContent="生成安全二维码"}
  }

  $("adminPassword").value=sessionStorage.getItem("k8_qr_admin_password")||"";
  $("generate").onclick=generate;
  $("print").onclick=()=>{$("cards").children.length?window.print():toast("请先生成二维码")};
  $("clear").onclick=()=>{$("rooms").value="";$("cards").innerHTML="";$("emptyState").classList.remove("hidden")};
})();
