(function(){
  const $=id=>document.getElementById(id);
  const config=window.HOTEL_CONFIG||{};
  const STORAGE_KEY="k8_qr_designer_v4";

  function toast(message){
    const el=$("toast");
    el.textContent=message;
    el.classList.remove("hidden");
    clearTimeout(window.__qrToast);
    window.__qrToast=setTimeout(()=>el.classList.add("hidden"),2200);
  }

  function parseRooms(){
    return [...new Set(
      $("rooms").value
        .split(/[\s,，、;；]+/)
        .map(value=>value.trim())
        .filter(Boolean)
        .slice(0,300)
    )];
  }

  function buildRoomUrl(baseValue,room){
    const url=new URL(baseValue.trim(),location.href);
    ["ticket","track","v"].forEach(key=>url.searchParams.delete(key));
    url.searchParams.set("room",room);
    url.hash="";
    return url.toString();
  }

  function createText(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    el.textContent=text;
    return el;
  }

  function createCard(room,url,settings){
    const card=document.createElement("article");
    card.className="room-card theme-"+settings.theme;

    const top=document.createElement("div");
    top.className="card-top";

    const brand=document.createElement("div");
    brand.className="brand-lockup";

    const brandMini=createText("div","brand-mini","K8");
    const brandText=document.createElement("div");
    brandText.appendChild(createText("div","brand-name",settings.hotelName));
    brandText.appendChild(createText("div","card-en","SMART HOTEL · GUEST SERVICE"));
    brand.append(brandMini,brandText);

    top.append(brand,createText("div","room-tag","ROOM SERVICE"));

    const roomMain=document.createElement("div");
    roomMain.className="room-main";
    roomMain.append(
      createText("div","room-label","ROOM NUMBER"),
      createText("div","room-number",room),
      createText("div","card-title",settings.cardTitle)
    );

    const qrShell=document.createElement("div");
    qrShell.className="qr-shell";
    const qr=document.createElement("div");
    qr.className="qr";
    qrShell.appendChild(qr);

    if(settings.showLogo){
      qrShell.appendChild(createText("div","qr-logo","K8"));
    }

    const scanLine=createText("div","scan-line","微信扫一扫");

    const pills=document.createElement("div");
    pills.className="service-pills";
    ["客房用品","清洁服务","设备报修","前台咨询"].forEach(text=>{
      pills.appendChild(createText("span","",text));
    });

    const bottom=document.createElement("div");
    bottom.className="card-bottom";
    bottom.append(
      createText("b","","需求直达前台 · 处理进度实时查看"),
      createText("small","","请保留页面，前台回复将在页面持续显示")
    );

    card.append(top,roomMain,qrShell,scanLine,pills,bottom);

    new QRCode(qr,{
      text:url,
      width:232,
      height:232,
      colorDark:"#111111",
      colorLight:"#ffffff",
      correctLevel:QRCode.CorrectLevel.H
    });

    card.title=url;
    return card;
  }

  function readSettings(){
    return {
      hotelName:$("hotelName").value.trim()||"K8智享酒店",
      theme:$("theme").value,
      baseUrl:$("baseUrl").value.trim(),
      cardTitle:$("cardTitle").value.trim()||"专属住客服务",
      showLogo:$("showLogo").checked,
      rooms:$("rooms").value
    };
  }

  function saveSettings(settings){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}catch(e){}
  }

  function restoreSettings(){
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch(e){}
    $("hotelName").value=saved?.hotelName||config.hotelName||"K8智享酒店";
    $("theme").value=saved?.theme||"emerald";
    $("baseUrl").value=saved?.baseUrl||"https://5214441.github.io/k8-hotel-service/";
    $("cardTitle").value=saved?.cardTitle||"专属住客服务";
    $("showLogo").checked=saved?.showLogo!==false;
    $("rooms").value=saved?.rooms||"";
  }

  function generate(){
    if(typeof QRCode==="undefined"){
      toast("二维码组件未加载，请检查网络后刷新");
      return;
    }

    const settings=readSettings();
    const roomList=parseRooms();

    if(!settings.baseUrl){
      toast("请填写住客服务网址");
      $("baseUrl").focus();
      return;
    }

    if(!roomList.length){
      toast("请先输入房号");
      $("rooms").focus();
      return;
    }

    try{
      new URL(settings.baseUrl,location.href);
    }catch(e){
      toast("住客服务网址格式不正确");
      $("baseUrl").focus();
      return;
    }

    const root=$("cards");
    root.innerHTML="";
    const fragment=document.createDocumentFragment();

    roomList.forEach(room=>{
      const url=buildRoomUrl(settings.baseUrl,room);
      fragment.appendChild(createCard(room,url,settings));
    });

    root.appendChild(fragment);
    $("emptyState").classList.add("hidden");
    saveSettings(settings);
    toast("已生成 "+roomList.length+" 个美化二维码");
    root.scrollIntoView({behavior:"smooth",block:"start"});
  }

  $("generate").onclick=generate;
  $("print").onclick=()=>{
    if(!$("cards").children.length){
      toast("请先生成二维码");
      return;
    }
    window.print();
  };
  $("clear").onclick=()=>{
    $("rooms").value="";
    $("cards").innerHTML="";
    $("emptyState").classList.remove("hidden");
    saveSettings(readSettings());
    $("rooms").focus();
  };

  $("theme").onchange=()=>{
    if($("cards").children.length)generate();
  };
  $("showLogo").onchange=()=>{
    if($("cards").children.length)generate();
  };

  restoreSettings();
})();