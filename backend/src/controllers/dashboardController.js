import mongoose from 'mongoose';
import Product from '../models/Product.js'; import Invoice from '../models/Invoice.js'; import Inventory from '../models/Inventory.js';
import Batch from '../models/Batch.js'; import Expense from '../models/Expense.js'; import SalesReturn from '../models/SalesReturn.js';
import MoneyReceipt from '../models/MoneyReceipt.js'; import Branch from '../models/Branch.js';
const round=n=>Math.round((Number(n||0)+Number.EPSILON)*100)/100;
const validDate=v=>v&&!Number.isNaN(new Date(v).getTime());
export async function summary(req,res,next){try{
 const owner=req.user.role==='owner', bf=req.branchId?{branchId:req.branchId}:{};
 const from=validDate(req.query.from)?new Date(req.query.from):new Date(new Date().setHours(0,0,0,0));
 const to=validDate(req.query.to)?new Date(req.query.to):new Date(); to.setHours(23,59,59,999);
 if(from>to)return res.status(400).json({message:'Start date cannot be after end date.'});
 const [products,inventory,invoices,returns,expenses,receipts,batches,latestInvoices,branches]=await Promise.all([
 Product.countDocuments({active:true}),Inventory.find(bf).populate('productId','name sku'),
 Invoice.find({...bf,invoiceDate:{$gte:from,$lte:to}}).lean(),
 SalesReturn.find({...bf,returnDate:{$gte:from,$lte:to}}).lean(),
 owner?Expense.find({...bf,expenseDate:{$gte:from,$lte:to}}).lean():[],
 MoneyReceipt.find({...bf,receiptDate:{$gte:from,$lte:to}}).lean(),
 owner?Batch.find({...bf,active:true}).select('+purchasePrice').lean():[],
 Invoice.find(bf).sort({createdAt:-1}).limit(7).lean(),
 owner&&!req.branchId?Branch.find({active:true}).select('name code').lean():[]
 ]);
 let sales=0,returnsTotal=0,cogs=0,returnedCost=0,unknownCostQty=0,soldQty=0,due=0,cash=0,qr=0;
 const productsMap=new Map();
 const add=(name,qty,amount,cost)=>{let x=productsMap.get(name)||{name,quantity:0,sales:0,cost:0};x.quantity+=qty;x.sales+=amount;x.cost+=cost;productsMap.set(name,x);};
 for(const inv of invoices){sales+=Number(inv.total||0);due+=Number(inv.dueAmount||0);cash+=Number(inv.cashAmount||0);qr+=Number(inv.banglaQrAmount||0);
  for(const it of inv.items||[]){soldQty+=Number(it.quantity||0);let cost=0,known=0;for(const a of it.batchAllocations||[]){if(a.unitCost!=null&&a.costStatus==='confirmed'){cost+=Number(a.quantity||0)*Number(a.unitCost||0);known+=Number(a.quantity||0);}}
   unknownCostQty+=Math.max(0,Number(it.quantity||0)-known);cogs+=cost;add(it.name,Number(it.quantity||0),Number(it.lineTotal||0),cost);
  }}
 const returnInvoiceIds=[...new Set(returns.map(x=>String(x.invoiceId)))].filter(id=>!invoices.some(x=>String(x._id)===id));
 const returnInvoices=returnInvoiceIds.length?await Invoice.find({...bf,_id:{$in:returnInvoiceIds}}).lean():[];
 for(const ret of returns){returnsTotal+=Number(ret.totalRefund||0);const inv=invoices.find(x=>String(x._id)===String(ret.invoiceId))||returnInvoices.find(x=>String(x._id)===String(ret.invoiceId));
  for(const it of ret.items||[]){const orig=inv?.items?.[it.invoiceItemIndex];let cost=0;for(const a of it.allocations||[]){const match=(orig?.batchAllocations||[]).find(x=>String(x.batchId)===String(a.batchId));if(match?.unitCost!=null&&match.costStatus==='confirmed')cost+=Number(a.quantity||0)*Number(match.unitCost||0);}
   returnedCost+=cost;add(it.name,-Number(it.quantity||0),-Number(it.lineRefundTotal||0),-cost);
  }}
 const expenseTotal=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
 cash+=receipts.reduce((s,x)=>s+Number(x.cashAmount||0),0);qr+=receipts.reduce((s,x)=>s+Number(x.banglaQrAmount||0),0);
 const netRevenue=round(sales-returnsTotal),grossProfit=round(netRevenue-(cogs-returnedCost)),netProfit=round(grossProfit-expenseTotal);
 const byCategory={};for(const e of expenses)byCategory[e.category]=round((byCategory[e.category]||0)+Number(e.amount||0));
 const result={range:{from,to},products,lowStock:inventory.filter(x=>x.quantity<=5).length,stockQty:round(inventory.reduce((s,x)=>s+Number(x.quantity||0),0)),
 invoiceCount:invoices.length,grossSales:round(sales),returns:round(returnsTotal),netRevenue,totalDue:round(due),cashCollected:round(cash),qrCollected:round(qr),
 latestInvoices,productPerformance:[...productsMap.values()].map(x=>({name:x.name,quantity:round(x.quantity),sales:round(x.sales),...(owner?{profit:round(x.sales-x.cost)}:{})})).sort((a,b)=>b.sales-a.sales).slice(0,10)};
 if(owner){const stockCost=batches.reduce((s,b)=>s+(b.purchasePrice==null?0:Number(b.quantity||0)*Number(b.purchasePrice||0)),0);
  const stockRetail=batches.reduce((s,b)=>s+Number(b.quantity||0)*Number(b.sellingPrice||0),0);
  result.cogs=round(cogs-returnedCost);result.grossProfit=grossProfit;result.expenses=round(expenseTotal);result.netProfit=netProfit;
  result.stockCostValue=round(stockCost);result.stockRetailValue=round(stockRetail);
  result.costCoverage={knownCostQuantity:round(Math.max(0,soldQty-unknownCostQty)),unknownCostQuantity:round(unknownCostQty)};
  result.expenseByCategory=byCategory;
  if(branches.length)result.branchComparison=await Promise.all(branches.map(async b=>{const [iv,ex,re]=await Promise.all([
   Invoice.find({branchId:b._id,invoiceDate:{$gte:from,$lte:to}}).select('total').lean(),
   Expense.find({branchId:b._id,expenseDate:{$gte:from,$lte:to}}).select('amount').lean(),
   SalesReturn.find({branchId:b._id,returnDate:{$gte:from,$lte:to}}).select('totalRefund').lean()]);
   const s=iv.reduce((a,x)=>a+Number(x.total||0),0),r=re.reduce((a,x)=>a+Number(x.totalRefund||0),0),e=ex.reduce((a,x)=>a+Number(x.amount||0),0);
   return {branchId:b._id,name:b.name,sales:round(s),returns:round(r),expenses:round(e),netRevenue:round(s-r)};}));
 }
 res.json(result);
 }catch(e){next(e);}}
