const money = value => Number(value || 0).toFixed(2);

export function renderTemplate(eventType, language, data) {
  const bn = language === 'bn';
  const name = data.customerName || (bn ? 'গ্রাহক' : 'Customer');
  const shop = data.businessName || (bn ? 'আমাদের দোকান' : 'our shop');
  const messages = {
    'invoice.created': bn
      ? `প্রিয় ${name}, ${shop}-এ আপনার ইনভয়েস ${data.number} তৈরি হয়েছে। মোট: ৳${money(data.total)}, জমা: ৳${money(data.paid)}, বাকি: ৳${money(data.due)}।`
      : `Dear ${name}, invoice ${data.number} was created at ${shop}. Total: BDT ${money(data.total)}, paid: BDT ${money(data.paid)}, due: BDT ${money(data.due)}.`,
    'sales_return.created': bn
      ? `প্রিয় ${name}, রিটার্ন ${data.number} (${data.invoiceNo}) প্রক্রিয়া হয়েছে। পরিমাণ: ৳${money(data.total)}। নিষ্পত্তি: ${data.settlementLabel}।`
      : `Dear ${name}, return ${data.number} (${data.invoiceNo}) was processed. Amount: BDT ${money(data.total)}. Settlement: ${data.settlementLabel}.`,
    'money_receipt.created': bn
      ? `প্রিয় ${name}, রসিদ ${data.number} অনুযায়ী ৳${money(data.amount)} গ্রহণ করা হয়েছে। ধন্যবাদ।`
      : `Dear ${name}, we received BDT ${money(data.amount)} under receipt ${data.number}. Thank you.`,
    'customer.account_summary': bn
      ? `প্রিয় ${name}, হিসাব বিবরণী: ইনভয়েস বকেয়া ৳${money(data.invoiceOutstanding)}, জমা ৳${money(data.moneyReceipts)}, বকেয়া সমন্বয় ৳${money(data.dueAdjustments)}, নগদ ফেরত ৳${money(data.cashRefunds)}, সর্বমোট বকেয়া ৳${money(data.grandDue)}।`
      : `Dear ${name}, account summary: invoice outstanding BDT ${money(data.invoiceOutstanding)}, money receipts BDT ${money(data.moneyReceipts)}, due adjustments BDT ${money(data.dueAdjustments)}, cash refunds BDT ${money(data.cashRefunds)}, grand due BDT ${money(data.grandDue)}.`
  };
  const body = messages[eventType];
  if (!body) throw new Error(`Unsupported notification template: ${eventType}`);
  return body;
}
