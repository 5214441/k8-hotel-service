(function(){
  const config=window.HOTEL_CONFIG||{};
  const $=id=>document.getElementById(id);
  const api=String(config.apiBase||"").replace(/\/$/,"");
  let password=sessionStorage.getItem("k8_admin_password")||localStorage.getItem("k8_admin_password")||"";
  let tickets=[],knownIds=new Set(),audioCtx=null,soundEnabled=false,lastAlarm=0,polling=false;
  let historyPage=1,historyTotalPages=1,historyRows=[];
  const drafts=new Map();

  function toast(msg){const el=$("toast");el.textContent=msg;el.classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.add("hidden"),2200)}
  function formatTime(s){if(!s)return "—";return new Date(s).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}
  function durationMinutes(start,end){if(!start)return 0;const a=new Date(start).getTime(),b=end?new Date(end).getTime():Date.now();return Math.max(0,Math.floor((b-a)/60000))}
  function remainingMinutes(deadline){if(!deadline)return null;return Math.ceil((new Date(deadline).getTime()-Date.now())/60000)}
  function authHeaders(){return {"Content-Type":"application/json","X-Admin-Password":password}}
  function apiReady(){return /^https:\/\/.+/.test(api)&&!api.includes("请替换")}
  function isEditing(){const el=document.activeElement;return !!el&&(el.classList.contains("reply-input")||el.classList.contains("eta-select"))}
  function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function escapeAttr(v){return escapeHtml(v).replace(/`/g,"&#96;")}
  function parseServices(t){if(Array.isArray(t.services))return t.services;try{return JSON.parse(t.services||"[]")}catch{return []}}

  async function request(path,options={}){
    if(!apiReady())throw new Error("config.js 尚未填写 Worker 地址");
    const res=await fetch(api+path,{...options,headers:{...authHeaders(),...(options.headers||{})},cache:"no-store"});
    const data=await res.json().catch(()=>({}));
    if(res.status===401)throw new Error("管理密码错误");
    if(!res.ok)throw new Error(data.message||"请求失败");
    return data;
  }

  function beep(){
    if(!soundEnabled)return;
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      const now=audioCtx.currentTime;
      [0,.22,.44].forEach((d,i)=>{
        const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
        osc.frequency.value=i===1?980:760;
        gain.gain.setValueAtTime(.0001,now+d);
        gain.gain.exponentialRampToValueAtTime(.22,now+d+.02);
        gain.gain.exponentialRampToValueAtTime(.0001,now+d+.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now+d);osc.stop(now+d+.2);
      });
    }catch{}
  }

  function desktopNotify(t){
    if(Notification.permission!=="granted")return;
    const n=new Notification(`K8酒店新工单 · ${t.room}房`,{body:parseServices(t).join("、")+(t.remark?"\n"+t.remark:""),tag:t.id,renotify:true});
    n.onclick=()=>{window.focus();n.close()};
  }

  function defaultReply(type){return type==="new"?"已收到，正在为您安排。":"工作人员正在处理，请稍候。"}
  function getDraft(t,type){
    if(!drafts.has(t.id))drafts.set(t.id,{reply:t.staff_reply||defaultReply(type),eta:t.eta_minutes==null?"":String(t.eta_minutes)});
    return drafts.get(t.id);
  }

  function replyControls(t,type){
    const draft=getDraft(t,type),wrap=document.createElement("div");
    wrap.className="reply-controls";
    const replies=config.quickReplies||["已收到，马上为您安排。","工作人员正在前往您的房间，请稍候。","当前需求较多，可能需要稍等，感谢理解。","物品已放在房门口，请查收。"];
    wrap.innerHTML=`<label>${type==="new"?"接单回复（客人实时可见）":"更新给客人的回复"}</label>
      <div class="reply-row"><input class="reply-input" maxlength="200" value="${escapeAttr(draft.reply)}"><select class="eta-select">
      <option value="">不显示预计时间</option>${[3,5,10,15,20,30,45,60].map(n=>`<option value="${n}" ${String(draft.eta)===String(n)?"selected":""}>约${n}分钟</option>`).join("")}</select></div>
      <div class="quick-replies">${replies.map((x,i)=>`<button type="button" data-text="${escapeAttr(x)}">${["马上安排","正在前往","需要稍等","已放门口"][i]||"快捷回复"}</button>`).join("")}</div>`;
    const input=wrap.querySelector(".reply-input"),eta=wrap.querySelector(".eta-select");
    input.oninput=()=>getDraft(t,type).reply=input.value;
    eta.onchange=()=>getDraft(t,type).eta=eta.value;
    wrap.querySelectorAll(".quick-replies button").forEach(b=>b.onclick=()=>{input.value=b.dataset.text;getDraft(t,type).reply=input.value;input.focus()});
    return wrap;
  }

  function ticketSeverity(t){
    const mins=durationMinutes(t.created_at);
    if(mins>=20)return "critical";
    if(mins>=10)return "urgent";
    if(mins>=5)return "warn";
    return "";
  }

  function ratingHtml(t){
    if(!t.rating)return "";
    const labels={satisfied:"满意",average:"一般",unsatisfied:"不满意"};
    return `<div class="rating-badge ${escapeAttr(t.rating)}">服务评价：${labels[t.rating]||escapeHtml(t.rating)}</div>${t.rating_comment?`<div class="rating-comment">${escapeHtml(t.rating_comment)}</div>`:""}`;
  }

  function feedbackHtml(t){
    if(t.guest_resolution==="resolved")return '<div class="guest-feedback resolved">客人确认：已经解决</div>';
    if(t.guest_resolution==="unresolved")return '<div class="guest-feedback unresolved">客人反馈：仍未解决</div>';
    if(t.status==="completed")return '<div class="guest-feedback pending">等待客人确认是否解决</div>';
    return "";
  }

  function renderList(id,list,type){
    const root=$(id);root.innerHTML="";
    if(!list.length){root.innerHTML='<div class="empty">暂无工单</div>';return}
    list.forEach(t=>{
      const card=document.createElement("article");
      card.className=`ticket ${type!=="done"?ticketSeverity(t):""}`;
      card.dataset.ticketId=t.id;
      const services=parseServices(t);
      const remain=remainingMinutes(t.eta_deadline);
      const timeLabel=type==="done"?`总耗时：${durationMinutes(t.created_at,t.completed_at)}分钟`
        :type==="accepted"?(remain==null?`处理中：${durationMinutes(t.accepted_at||t.created_at)}分钟`
        :remain>0?`预计剩余：${remain}分钟`:`预计时间已超时`)
        :`等待：${durationMinutes(t.created_at)}分钟`;

      card.innerHTML=`<div class="ticket-head"><div class="room">${escapeHtml(t.room)}房</div><div class="ticket-id">${escapeHtml(t.id)}</div></div>
        <div class="service">${escapeHtml(services.join("、")||"其他需求")}</div>
        ${t.remark?`<div class="remark">${escapeHtml(t.remark)}</div>`:""}
        <div class="meta"><span>提交：${formatTime(t.created_at)}</span><span class="countdown ${remain!=null&&remain<=0?"overdue":""}">${timeLabel}</span><span>称呼：${escapeHtml(t.guest_name||"未填写")}</span></div>
        ${feedbackHtml(t)}
        ${ratingHtml(t)}`;

      if(type==="new"||type==="accepted")card.appendChild(replyControls(t,type));
      if(type==="done"&&t.staff_reply){const r=document.createElement("div");r.className="current-reply";r.textContent="给客人的回复："+t.staff_reply;card.appendChild(r)}

      const actions=document.createElement("div");actions.className="ticket-actions";
      if(type==="new"){
        actions.append(button("接单并回复","",()=>sendAction(card,t.id,"accept")));
        actions.append(button("取消","cancel",()=>sendAction(card,t.id,"cancel")));
      }else if(type==="accepted"){
        actions.append(button("更新回复","reply",()=>sendAction(card,t.id,"reply")));
        actions.append(button("标记完成","complete",()=>{if(confirm("确认该需求已经处理完成？"))sendAction(card,t.id,"complete")}));
      }else if(type==="done"&&t.completed_at&&Date.now()-new Date(t.completed_at).getTime()<5*60000){
        actions.append(button("撤销完成","cancel",()=>sendAction(card,t.id,"undo_complete")));
      }
      actions.append(button("操作记录","event-button",()=>openEvents(t.id)));
      card.appendChild(actions);
      root.appendChild(card);
    });
  }

  function button(text,cls,fn){const b=document.createElement("button");b.textContent=text;b.className=cls;b.onclick=fn;return b}

  async function refresh(silent=false){
    if(polling||!password)return;
    polling=true;
    try{
      const [data,dash]=await Promise.all([request("/api/tickets?scope=board&pageSize=100"),request("/api/dashboard")]);
      tickets=data.tickets||[];
      $("networkBadge").textContent="在线";$("networkBadge").className="badge ok";$("loginOverlay").classList.add("hidden");
      const news=tickets.filter(x=>x.status==="new"),accepted=tickets.filter(x=>x.status==="accepted"),done=tickets.filter(x=>x.status==="completed");
      renderList("newList",news,"new");renderList("acceptedList",accepted,"accepted");renderList("doneList",done,"done");
      const s=dash.summary||{};
      $("newCount").textContent=s.newCount||0;$("acceptedCount").textContent=s.acceptedCount||0;$("doneCount").textContent=s.completedToday||0;
      $("avgResponse").textContent=s.avgResponse==null?"—":s.avgResponse.toFixed(1)+"分钟";
      $("avgComplete").textContent=s.avgComplete==null?"—":s.avgComplete.toFixed(1)+"分钟";
      $("unresolvedCount").textContent=s.unresolvedToday||0;
      $("satisfactionRate").textContent=s.satisfactionRate==null?"—":s.satisfactionRate+"%";
      $("badRatingCount").textContent=s.unsatisfiedRatingToday||0;
      news.forEach(t=>{if(!knownIds.has(t.id)){knownIds.add(t.id);beep();desktopNotify(t)}});
      if(news.length&&Date.now()-lastAlarm>12000){beep();lastAlarm=Date.now()}
      if(!silent)toast("工单已刷新");
    }catch(e){
      $("networkBadge").textContent=e.message.includes("密码")?"密码错误":"离线";$("networkBadge").className="badge bad";
      if(e.message.includes("密码")){$("loginOverlay").classList.remove("hidden");$("loginError").textContent=e.message;$("loginError").classList.remove("hidden")}
      if(!silent)toast(e.message);
    }finally{polling=false}
  }

  async function sendAction(card,id,action){
    const input=card.querySelector(".reply-input"),eta=card.querySelector(".eta-select");
    const reply=input?input.value.trim():"";
    const etaMinutes=eta&&eta.value?Number(eta.value):null;
    try{
      await request(`/api/tickets/${encodeURIComponent(id)}`,{method:"PATCH",body:JSON.stringify({action,reply,etaMinutes})});
      drafts.delete(id);
      toast(action==="accept"?"已接单并回复":action==="complete"?"已完成并通知客人":action==="undo_complete"?"已撤销完成":"状态已更新");
      await refresh(true);
    }catch(e){toast(e.message)}
  }

  function localDate(date){const d=new Date(date),p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
  function statusText(s){return {new:"新工单",accepted:"处理中",completed:"已完成",cancelled:"已取消"}[s]||s}

  function openHistory(){
    if(!$("historyFrom").value){const d=new Date();d.setDate(d.getDate()-7);$("historyFrom").value=localDate(d)}
    if(!$("historyTo").value)$("historyTo").value=localDate(new Date());
    $("historyPanel").classList.remove("hidden");document.body.style.overflow="hidden";historyPage=1;queryHistory();
  }
  function closeHistory(){$("historyPanel").classList.add("hidden");document.body.style.overflow=""}
  function resetHistory(){const d=new Date();d.setDate(d.getDate()-7);$("historyFrom").value=localDate(d);$("historyTo").value=localDate(new Date());$("historyRoom").value="";$("historyStatus").value="";$("historyKeyword").value="";historyPage=1;queryHistory()}

  async function queryHistory(){
    $("historyResults").innerHTML='<div class="empty">正在查询…</div>';
    const q=new URLSearchParams({page:String(historyPage),pageSize:"50"});
    if($("historyFrom").value)q.set("from",$("historyFrom").value);
    if($("historyTo").value)q.set("to",$("historyTo").value);
    if($("historyRoom").value.trim())q.set("room",$("historyRoom").value.trim());
    if($("historyStatus").value)q.set("status",$("historyStatus").value);
    if($("historyKeyword").value.trim())q.set("keyword",$("historyKeyword").value.trim());
    try{
      const data=await request("/api/tickets?"+q.toString());
      historyRows=data.tickets||[];historyTotalPages=data.pagination?.totalPages||1;
      $("historyResultCount").textContent=`共 ${data.pagination?.total||0} 条`;
      $("historyPage").textContent=`第 ${historyPage} / ${historyTotalPages} 页`;
      $("historyPrev").disabled=historyPage<=1;$("historyNext").disabled=historyPage>=historyTotalPages;
      renderHistory(historyRows);
    }catch(e){$("historyResults").innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
  }

  function renderHistory(rows){
    if(!rows.length){$("historyResults").innerHTML='<div class="empty">没有找到符合条件的工单</div>';return}
    $("historyResults").innerHTML=`<div class="history-table-wrap"><table class="history-table"><thead><tr><th>房间</th><th>状态</th><th>服务与备注</th><th>时间</th><th>总耗时</th><th>前台回复</th><th>客人确认</th><th>服务评价</th><th>工单号</th></tr></thead><tbody>
    ${rows.map(t=>`<tr><td><b>${escapeHtml(t.room)}房</b></td><td><span class="history-status ${escapeAttr(t.status)}">${statusText(t.status)}</span></td>
    <td><b>${escapeHtml(parseServices(t).join("、")||"其他需求")}</b><br>${escapeHtml(t.remark||"")}</td>
    <td>提交：${formatTime(t.created_at)}<br>接单：${formatTime(t.accepted_at)}<br>完成：${formatTime(t.completed_at)}</td>
    <td>${durationMinutes(t.created_at,t.completed_at||undefined)}分钟</td><td>${escapeHtml(t.staff_reply||"—")}</td><td>${escapeHtml(t.guest_resolution||"—")}</td>
    <td>${t.rating?`${{satisfied:"满意",average:"一般",unsatisfied:"不满意"}[t.rating]||escapeHtml(t.rating)}${t.rating_comment?"<br>"+escapeHtml(t.rating_comment):""}`:"—"}</td>
    <td>${escapeHtml(t.id)}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  function csvCell(v){return `"${String(v??"").replace(/"/g,'""')}"`}
  function exportHistory(){
    if(!historyRows.length){toast("当前页没有可导出记录");return}
    const rows=[["房间","状态","服务","备注","称呼","提交时间","接单时间","完成时间","前台回复","客人确认","服务评价","评价留言","评价时间","工单号"],...historyRows.map(t=>[t.room,statusText(t.status),parseServices(t).join("、"),t.remark||"",t.guest_name||"",formatTime(t.created_at),formatTime(t.accepted_at),formatTime(t.completed_at),t.staff_reply||"",t.guest_resolution||"",({satisfied:"满意",average:"一般",unsatisfied:"不满意"}[t.rating]||t.rating||""),t.rating_comment||"",formatTime(t.rated_at),t.id])];
    const blob=new Blob(["\ufeff"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`K8历史工单_${localDate(new Date())}_第${historyPage}页.csv`;a.click();URL.revokeObjectURL(url);
  }

  async function openEvents(id){
    $("eventPanel").classList.remove("hidden");$("eventTicketId").textContent=id;$("eventList").innerHTML='<div class="empty">正在读取…</div>';
    try{
      const data=await request(`/api/tickets/${encodeURIComponent(id)}/events`);
      $("eventList").innerHTML=(data.events||[]).length?(data.events||[]).map(e=>`<div class="event-item"><div class="event-time">${formatTime(e.created_at)}</div><div class="event-actor">${escapeHtml(e.actor)}</div><div class="event-message"><b>${escapeHtml(e.event_type)}</b><br>${escapeHtml(e.message||"")}</div></div>`).join(""):'<div class="empty">暂无操作记录</div>';
    }catch(e){$("eventList").innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`}
  }

  $("loginForm").onsubmit=async e=>{e.preventDefault();password=$("passwordInput").value;sessionStorage.setItem("k8_admin_password",password);$("rememberPassword").checked?localStorage.setItem("k8_admin_password",password):localStorage.removeItem("k8_admin_password");$("loginError").classList.add("hidden");await refresh(true)};
  $("logoutBtn").onclick=()=>{password="";sessionStorage.removeItem("k8_admin_password");localStorage.removeItem("k8_admin_password");$("loginOverlay").classList.remove("hidden")};
  $("refreshBtn").onclick=()=>refresh();
  $("soundBtn").onclick=async()=>{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume();soundEnabled=true;$("soundBtn").textContent="声音提醒已开启";beep()};
  $("notifyBtn").onclick=async()=>{const p=await Notification.requestPermission();$("notifyBtn").textContent=p==="granted"?"桌面通知已开启":"通知未授权"};
  $("historyBtn").onclick=openHistory;$("historyClose").onclick=closeHistory;$("historySearch").onclick=()=>{historyPage=1;queryHistory()};$("historyReset").onclick=resetHistory;$("historyExport").onclick=exportHistory;
  $("historyPrev").onclick=()=>{if(historyPage>1){historyPage--;queryHistory()}};$("historyNext").onclick=()=>{if(historyPage<historyTotalPages){historyPage++;queryHistory()}};
  $("eventClose").onclick=()=>$("eventPanel").classList.add("hidden");
  setInterval(()=>{$("clock").textContent=new Date().toLocaleString("zh-CN",{hour12:false})},1000);
  setInterval(()=>{if(!isEditing()&&!document.hidden)refresh(true)},(config.pollSeconds||4)*1000);
  window.addEventListener("online",()=>refresh(true));window.addEventListener("offline",()=>{$("networkBadge").textContent="离线";$("networkBadge").className="badge bad"});
  if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
  if(password){$("passwordInput").value=password;refresh(true)}
})();
