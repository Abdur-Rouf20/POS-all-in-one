import mongoose from 'mongoose';
const schema=new mongoose.Schema({branchId:{type:mongoose.Schema.Types.ObjectId,ref:'Branch',required:true,index:true},productId:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true,index:true},quantity:{type:Number,default:0,min:0},updatedBy:{userId:{type:mongoose.Schema.Types.ObjectId,ref:'User'},name:String}}, {timestamps:true});
schema.index({branchId:1,productId:1},{unique:true});
export default mongoose.model('Inventory',schema);
