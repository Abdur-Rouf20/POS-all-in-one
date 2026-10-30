import mongoose from 'mongoose';
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true},email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true,select:false},role:{type:String,enum:['owner','salesman'],required:true},branchId:{type:mongoose.Schema.Types.ObjectId,ref:'Branch',default:null},active:{type:Boolean,default:true},permissions:{type:[String],default:[]}}, {timestamps:true});
export default mongoose.model('User',schema);
