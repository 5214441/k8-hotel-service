const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8",...extra}});
const clean=(v,n=200)=>String(v??"").trim().slice(0,n);
function cors(req,env){
  const origin=req.headers.get("Origin")||"*";
  const allowed=clean(env.ALLOWED_ORIGINS||"");
  const ok=!allowed||allowed.split(",").map(x=>x.trim()).includes(origin);
  return {"Access-Control-Allow-Origin":ok?origin:"null","Vary":"Origin","Access-Control-Allow-Headers":"Content-Type,X-Admin-Password","Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS"};
}
async function hashText(text){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("").slice(0,24)}
function localStamp(){
  const d=new Date(Date.now()+8*3600000),p=n=>String(n).padStart(2,"0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}
function authorized(req,env){const a=req.headers.get("X-Admin-Password")||"";return !!env.ADMIN_PASSWORD&&a===env.ADMIN_PASSWORD}
export default {
 async fetch(req,env){
  const headers=cors(req,env),url=new URL(req.url);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  try{
   if(url.pathname==="/api/health")return json({ok:true,time:new Date().toISOString()},200,headers);
   if(url.pathname==="/api/tickets"&&req.method==="POST"){
    const body=await req.json().catch(()=>({}));
    const room=clean(body.room,12).replace(/[^\w\u4e00-\u9fa5-]/g,"");
    const services=Array.isArray(body.services)?body.services.map(x=>clean(x,60)).filter(Boolean).slice(0,12):[];
    const remark=clean(body.remark,200),guestName=clean(body.guestName,20);
    if(!room||(!services.length&&!remark))return json({message:"房间号和服务需求不能为空"},400,headers);
    const ip=req.headers.get("CF-Connecting-IP")||"unknown";
    const clientHash=await hashText(ip+"|"+room);
    const recent=await env.DB.prepare("SELECT COUNT(*) AS c FROM tickets WHERE client_hash=? AND created_at>datetime('now','-1 minute')").bind(clientHash).first();
    if((recent?.c||0)>=3)return json({message:"提交过于频繁，请稍后再试"},429,headers);
    const duplicate=await env.DB.prepare("SELECT id FROM tickets WHERE room=? AND status IN ('new','accepted') AND created_at>datetime('now','-10 minutes') ORDER BY created_at DESC LIMIT 1").bind(room).first();
    if(duplicate)return json({message:"该房间已有未完成工单："+duplicate.id},409,headers);
    const id=`${room}-${localStamp()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
    const createdAt=new Date().toISOString();
    await env.DB.prepare("INSERT INTO tickets(id,room,services,remark,guest_name,status,created_at,client_hash) VALUES(?,?,?,?,?,'new',?,?)")
      .bind(id,room,JSON.stringify(services),remark,guestName,createdAt,clientHash).run();
    return json({ok:true,ticket:{id,room,status:"new",created_at:createdAt}},201,headers);
   }
   if(url.pathname==="/api/tickets"&&req.method==="GET"){
    if(!authorized(req,env))return json({message:"管理密码错误"},401,headers);
    const limit=Math.min(Math.max(Number(url.searchParams.get("limit"))||100,1),300);
    const rows=await env.DB.prepare("SELECT * FROM tickets ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    const tickets=(rows.results||[]).map(x=>({...x,services:JSON.parse(x.services||"[]")}));
    return json({tickets},200,headers);
   }
   const match=url.pathname.match(/^\/api\/tickets\/([^/]+)$/);
   if(match&&req.method==="PATCH"){
    if(!authorized(req,env))return json({message:"管理密码错误"},401,headers);
    const id=decodeURIComponent(match[1]),body=await req.json().catch(()=>({})),action=clean(body.action,20),staff=clean(body.staff,30)||"前台";
    let sql,args;
    if(action==="accept"){sql="UPDATE tickets SET status='accepted',accepted_at=?,accepted_by=? WHERE id=? AND status='new'";args=[new Date().toISOString(),staff,id]}
    else if(action==="complete"){sql="UPDATE tickets SET status='completed',completed_at=?,completed_by=? WHERE id=? AND status='accepted'";args=[new Date().toISOString(),staff,id]}
    else if(action==="cancel"){sql="UPDATE tickets SET status='cancelled',completed_at=?,completed_by=? WHERE id=?";args=[new Date().toISOString(),staff,id]}
    else if(action==="reopen"){sql="UPDATE tickets SET status='new',accepted_at=NULL,accepted_by=NULL,completed_at=NULL,completed_by=NULL WHERE id=?";args=[id]}
    else return json({message:"不支持的操作"},400,headers);
    const result=await env.DB.prepare(sql).bind(...args).run();
    if(!result.meta?.changes)return json({message:"工单状态已变化，请刷新后重试"},409,headers);
    return json({ok:true},200,headers);
   }
   return json({message:"Not Found"},404,headers);
  }catch(e){return json({message:"服务器处理失败",detail:String(e?.message||e)},500,headers)}
 }
};