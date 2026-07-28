(function(){
 const $=id=>document.getElementById(id), cfg=window.HOTEL_CONFIG||{};
 function defaultBase(){return location.href.replace(/qr\.html(?:\?.*)?$/,'').replace(/\?.*$/,'')}
 $('baseUrl').value=defaultBase();
 function parseRooms(text){const out=[];text.split(/[\s,，;；]+/).filter(Boolean).forEach(part=>{const m=part.match(/^(\d+)\s*[-—~至]\s*(\d+)$/);if(m){let a=+m[1],b=+m[2];const step=a<=b?1:-1;if(Math.abs(b-a)<=200)for(let n=a;;n+=step){out.push(String(n));if(n===b)break}}else out.push(part)});return [...new Set(out)]}
 function generate(){
   const rooms=parseRooms($('rooms').value); if(!rooms.length){alert('请先输入房间号');return}
   if(typeof QRCode==='undefined'){alert('二维码组件加载失败，请检查网络后重试');return}
   const base=$('baseUrl').value.trim().replace(/\?room=.*$/,'').replace(/\/$/,'/')||defaultBase();
   const box=$('cards');box.innerHTML='';$('empty').style.display='none';
   rooms.forEach(room=>{const url=base+'?room='+encodeURIComponent(room);const card=document.createElement('article');card.className='qr-card';card.innerHTML='<h2>'+(cfg.hotelName||'酒店')+'</h2><div class="room">'+room+' 房</div><div class="qr"></div><p>扫码联系前台微信 · 客房服务</p><small>'+url+'</small>';box.appendChild(card);new QRCode(card.querySelector('.qr'),{text:url,width:190,height:190,colorDark:'#17201d',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H})})
 }
 $('generate').onclick=generate;$('print').onclick=()=>window.print();$('clear').onclick=()=>{$('rooms').value='';$('cards').innerHTML='';$('empty').style.display=''};
})();
