(function(){
  const config=window.HOTEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const services=[
    ["客房用品","水、纸巾、牙具等"],["打扫房间","清洁或补充用品"],["更换布草","毛巾、床单、被套"],
    ["设备报修","空调、电视、热水等"],["续住咨询","续住与房价确认"],["退房咨询","退房时间或寄存"],
    ["开票咨询","电子发票或抬头"],["租车服务","经济/商务/SUV/七座"],["其他需求","请在下方说明"]
  ];
  let selected=new Set();
  function queryRoom(){return new URLSearchParams(location.search).get('room')||''}
  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.add('hidden'),1800)}
  function render(){
    document.title=(config.hotelName||'酒店')+' · 住客服务';
    $('hotelName').textContent=config.hotelName||'酒店';
    const room=queryRoom();$('roomNo').textContent=room||'未识别';$('roomInput').value=room;
    $('hotelAddress').textContent=config.address||'请通过微信咨询前台';
    $('wifiText').textContent=config.wifiText||'请通过微信咨询前台';
    $('checkoutText').textContent=config.checkOutText||'请通过微信咨询前台';
    const grid=$('serviceGrid');
    services.forEach(([name,desc])=>{const b=document.createElement('button');b.className='service-chip';b.type='button';b.innerHTML='<b>'+name+'</b><small>'+desc+'</small>';b.onclick=()=>{selected.has(name)?selected.delete(name):selected.add(name);b.classList.toggle('selected',selected.has(name))};grid.appendChild(b)});
    (config.rentalPrices||[]).forEach(x=>{const d=document.createElement('div');d.className='rental-card';d.innerHTML='<b>'+x.name+'</b><strong>'+x.price+'</strong><small>'+x.note+'</small>';d.onclick=()=>{selected.add('租车服务-'+x.name);toast('已选择 '+x.name)};$('rentalGrid').appendChild(d)});
    const img=$('wechatQr');img.onerror=()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src='assets/wechat-qr.svg';return}img.classList.add('hidden');$('qrPlaceholder').classList.remove('hidden')};
    if(config.wechatId){$('copyWechatId').classList.remove('hidden');$('copyWechatId').onclick=()=>copy(config.wechatId,'前台微信号已复制')}
  }
  function nowText(){return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())}
  function build(){
    const room=$('roomInput').value.trim();
    if(!room){toast('请填写房间号');$('roomInput').focus();return}
    if(!selected.size&&!$('remark').value.trim()){toast('请选择服务或填写需求');return}
    const guest=$('guestName').value.trim()||'住客';
    const lines=[
      '【'+(config.shortName||config.hotelName||'酒店')+'住客服务单】',
      '房间：'+room,
      '称呼：'+guest,
      '需求：'+(selected.size?[...selected].join('、'):'见补充说明'),
      '说明：'+($('remark').value.trim()||'无'),
      '时间：'+nowText(),
      '',
      '麻烦前台微信确认收到，谢谢。'
    ];
    $('requestText').textContent=lines.join('\n');$('requestPanel').classList.remove('hidden');$('requestPanel').scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function copy(text,msg){try{await navigator.clipboard.writeText(text);toast(msg)}catch(e){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast(msg)}}
  $('buildRequest').onclick=build;
  $('copyRequest').onclick=()=>copy($('requestText').textContent,'服务单已复制，打开微信发送即可');
  $('openWechat').onclick=()=>{location.href='weixin://';setTimeout(()=>toast('如未打开，请手动进入微信'),700)};
  render();
})();
