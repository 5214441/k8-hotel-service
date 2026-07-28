(function(){
  const config=window.HOTEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const api=String(config.apiBase||"").replace(/\/$/,"");
  let password=sessionStorage.getItem("k8_admin_password")||localStorage.getItem("k8_admin_password")||"";
  let tickets=[],knownIds=new Set(),audioCtx=null,soundEnabled=false,lastAlarm=0,polling=false;
  const staffKey="k8_current_staff";
  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.add("hidden"),1800)}
  function formatTime(s){if(!s)return "—";return new Date(s).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}
  function minsSince(s){return Math.max(0,Math.floor((Date.now()-new Date(s).getTime())/60000))}
  function currentStaff(){return $("staffSelect").value||"前台"}
  function authHeaders(){return {"Content-Type":"application/json","X-Admin-Password":password}}
  function apiReady(){return /^https:\/\/.+/.test(api)&&!api.includes("请替换")}
  async function request(path,options={}){
    if(!apiReady())throw new Error("config.js 尚未填写 Worker 地址");
    const res=await fetch(api+path,{...options,headers:{...authHeaders(),...(options.headers||{})},cache:"no-store"});
    const data=await res.json().catch(()=>({}));if(res.status===401)throw new Error("管理密码错误");if(!res.ok)throw new Error(data.message||"请求失败");return data;
  }
  function beep(){if(!soundEnabled)return;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const now=audioCtx.currentTime;[0,.22,.44].forEach((d,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type="sine";osc.frequency.value=i===1?980:760;gain.gain.setValueAtTime(.0001,now+d);gain.gain.exponentialRampToValueAtTime(.22,now+d+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+d+.18);osc.connect(gain).connect(audioCtx.destination);osc.start(now+d);osc.stop(now+d+.2)})}catch(e){}}
  function desktopNotify(t){if(Notification.permission!=="granted")return;const n=new Notification("K8酒店新工单 · "+t.room+"房",{body:(t.services||[]).join("、")+(t.remark?"\n"+t.remark:""),tag:t.id,renotify:true});n.onclick=()=>{window.focus();n.close()}}
  function defaultReply(type){return type==="new"?"已收到，正在为您安排。":"工作人员正在处理，请稍候。"}
  function replyControls(t,type){
    const wrap=document.createElement("div");wrap.className="reply-controls";
    wrap.innerHTML=`<label>${type==="new"?"接单回复（客人会实时看到）":"更新给客人的回复"}</label>
      <div class="reply-row"><input class="reply-input" maxlength="120" value="${escapeAttr(t.staff_reply||defaultReply(type))}" placeholder="例如：已收到，正在安排"><select class="eta-select"><option value="">不显示预计时间</option>${[3,5,10,15,20,30].map(n=>`<option value="${n}" ${Number(t.eta_minutes)===n?"selected":""}>约${n}分钟</option>`).join("")}</select></div>
      <div class="quick-replies"><button type="button" data-text="已收到，马上为您安排。">马上安排</button><button type="button" data-text="工作人员正在前往您的房间，请稍候。">正在前往</button><button type="button" data-text="当前需求较多，可能需要稍等，感谢理解。">需要稍等</button></div>`;
    wrap.querySelectorAll(".quick-replies button").forEach(b=>b.onclick=()=>wrap.querySelector(".reply-input").value=b.dataset.text);return wrap;
  }
  function renderList(id,list,type){
    const root=$(id);root.innerHTML="";if(!list.length){root.innerHTML='<div class="empty">暂无工单</div>';return}
    list.forEach(t=>{
      const d=document.createElement("article");d.className="ticket";if(type==="new"&&minsSince(t.created_at)>=(config.overdueMinutes||5))d.classList.add("overdue");
      const services=Array.isArray(t.services)?t.services:(typeof t.services==="string"?JSON.parse(t.services||"[]"):[]);
      d.innerHTML=`<div class="ticket-head"><div class="room">${escapeHtml(t.room)}房</div><div class="ticket-id">${escapeHtml(t.id)}</div></div><div class="service">${escapeHtml(services.join("、")||"其他需求")}</div>${t.remark?`<div class="remark">${escapeHtml(t.remark)}</div>`:""}<div class="meta"><span>提交：${formatTime(t.created_at)}</span><span>等待：${minsSince(t.created_at)}分钟</span><span>称呼：${escapeHtml(t.guest_name||"未填写")}</span><span>接单：${escapeHtml(t.accepted_by||"—")}</span></div>`;
      if(type==="new"||type==="accepted")d.appendChild(replyControls(t,type));
      if(type==="done"&&t.staff_reply){const r=document.createElement("div");r.className="current-reply";r.textContent="给客人的回复："+t.staff_reply;d.appendChild(r)}
      const actions=document.createElement("div");actions.className="ticket-actions";
      if(type==="new"){actions.append(button("接单并回复","",()=>sendAction(d,t.id,"accept")));actions.append(button("取消","cancel",()=>sendAction(d,t.id,"cancel")))}
      else if(type==="accepted"){actions.append(button("更新回复","reply",()=>sendAction(d,t.id,"reply")));actions.append(button("标记完成","complete",()=>sendAction(d,t.id,"complete")));actions.append(button("退回","cancel",()=>sendAction(d,t.id,"reopen")))}
      d.appendChild(actions);root.appendChild(d);
    });
  }
  function button(text,cls,fn){const b=document.createElement("button");b.textContent=text;b.className=cls;b.onclick=fn;return b}
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,"&#96;")}
  async function refresh(silent=false){
    if(polling||!password)return;polling=true;
    try{
      const data=await request("/api/tickets?limit=200");tickets=data.tickets||[];$("networkBadge").textContent="在线";$("networkBadge").className="badge ok";$("loginOverlay").classList.add("hidden");
      const news=tickets.filter(x=>x.status==="new"),accepted=tickets.filter(x=>x.status==="accepted"),today=new Date().toLocaleDateString("en-CA"),done=tickets.filter(x=>x.status==="completed"&&new Date(x.completed_at).toLocaleDateString("en-CA")===today);
      renderList("newList",news,"new");renderList("acceptedList",accepted,"accepted");renderList("doneList",done,"done");$("newCount").textContent=news.length;$("acceptedCount").textContent=accepted.length;$("doneCount").textContent=done.length;
      const acceptedTimes=tickets.filter(x=>x.accepted_at&&x.created_at).map(x=>(new Date(x.accepted_at)-new Date(x.created_at))/60000).filter(x=>x>=0&&x<1440);$("avgResponse").textContent=acceptedTimes.length?(acceptedTimes.reduce((a,b)=>a+b,0)/acceptedTimes.length).toFixed(1)+"分钟":"—";
      news.forEach(t=>{if(!knownIds.has(t.id)){knownIds.add(t.id);beep();desktopNotify(t)}});if(news.length&&Date.now()-lastAlarm>12000){beep();lastAlarm=Date.now()}if(!silent)toast("工单已刷新");
    }catch(e){$("networkBadge").textContent=e.message.includes("密码")?"密码错误":"离线";$("networkBadge").className="badge bad";if(e.message.includes("密码")){$("loginOverlay").classList.remove("hidden");$("loginError").textContent=e.message;$("loginError").classList.remove("hidden")}if(!silent)toast(e.message)}finally{polling=false}
  }
  async function sendAction(card,id,action){
    const input=card.querySelector(".reply-input"),eta=card.querySelector(".eta-select");let reply=input?input.value.trim():"",etaMinutes=eta&&eta.value?Number(eta.value):null;
    if(action==="complete"&&!reply)reply="您的需求已处理完成，感谢您的耐心等待。";if(action==="cancel"&&!reply)reply="该服务单已取消，如仍有需要请重新提交。";
    try{await request("/api/tickets/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({action,staff:currentStaff(),reply,etaMinutes})});toast(action==="accept"?"已接单并回复客人":action==="complete"?"已完成并通知客人":action==="reply"?"回复已更新":"状态已更新");await refresh(true)}catch(e){toast(e.message)}
  }
  $("loginForm").onsubmit=async e=>{e.preventDefault();password=$("passwordInput").value;sessionStorage.setItem("k8_admin_password",password);if($("rememberPassword").checked)localStorage.setItem("k8_admin_password",password);else localStorage.removeItem("k8_admin_password");$("loginError").classList.add("hidden");await refresh(true)};
  $("logoutBtn").onclick=()=>{password="";sessionStorage.removeItem("k8_admin_password");localStorage.removeItem("k8_admin_password");$("loginOverlay").classList.remove("hidden")};$("refreshBtn").onclick=()=>refresh();
  $("soundBtn").onclick=async()=>{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();soundEnabled=true;$("soundBtn").textContent="声音提醒已开启";$("soundBtn").classList.add("active");beep()};
  $("notifyBtn").onclick=async()=>{const p=await Notification.requestPermission();$("notifyBtn").textContent=p==="granted"?"桌面通知已开启":"通知未授权";if(p==="granted")$("notifyBtn").classList.add("active")};
  (config.staffNames||["前台A","前台B"]).forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;$("staffSelect").appendChild(o)});$("staffSelect").value=localStorage.getItem(staffKey)||$("staffSelect").options[0].value;$("staffSelect").onchange=()=>localStorage.setItem(staffKey,$("staffSelect").value);
  setInterval(()=>{$("clock").textContent=new Date().toLocaleString("zh-CN",{hour12:false})},1000);setInterval(()=>refresh(true),(config.pollSeconds||4)*1000);window.addEventListener("online",()=>refresh(true));window.addEventListener("offline",()=>{$("networkBadge").textContent="离线";$("networkBadge").className="badge bad"});if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});if(password){$("passwordInput").value=password;refresh(true)}
})();
