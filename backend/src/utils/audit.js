import AuditLog from '../models/AuditLog.js';
export function actorOf(user){return {userId:user._id,name:user.name,role:user.role};}
export async function audit(req,action,entityType,entityId=null,details={}){return AuditLog.create({branchId:req.branchId||req.user.branchId||null,action,entityType,entityId,details,actor:actorOf(req.user)});}
