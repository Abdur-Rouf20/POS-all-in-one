import mongoose from 'mongoose';
const schema=new mongoose.Schema({branchId:{type:mongoose.Schema.Types.ObjectId,ref:'Branch',default:null,index:true},action:{type:String,required:true,index:true},entityType:{type:String,required:true},entityId:{type:mongoose.Schema.Types.ObjectId,default:null},details:{type:mongoose.Schema.Types.Mixed,default:{}},actor:{userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},name:{type:String,required:true},role:{type:String,required:true}}},{timestamps:true});
export default mongoose.model('AuditLog',schema);
