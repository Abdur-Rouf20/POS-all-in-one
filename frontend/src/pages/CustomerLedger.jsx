import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ReceiptText, Send } from 'lucide-react';
import { api } from '../services/api.js';

export default function CustomerLedger({ settings, t, lang }) {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    api.customerLedger(id).then(setData).catch(err => setError(err.message));
    api.customerNotifications(id).then(setNotifications).catch(() => {});
  }, [id]);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading">{t.loadingLedger}</div>;

  const { customer, summary, transactions } = data;
  async function sendSummary() { setBusy(true); setError(''); setNotice(''); try { await api.queueCustomerAccountSummary(id); setNotice(t.accountSummaryQueued || 'Account summary queued.'); setNotifications(await api.customerNotifications(id)); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function saveChannel(event) { try { const updated = await api.updateCustomerNotificationPreferences(id, { notifyChannel: event.target.value }); setData(current => ({ ...current, customer: updated })); setNotice(t.notificationPreferenceSaved || 'Notification preference saved.'); } catch (e) { setError(e.message); } }
  async function saveLanguage(event) { try { const updated = await api.updateCustomerNotificationPreferences(id, { preferredLanguage: event.target.value }); setData(current => ({ ...current, customer: updated })); setNotice(t.notificationPreferenceSaved || 'Notification preference saved.'); } catch (e) { setError(e.message); } }
  async function saveConsent(event) { try { const updated = await api.updateCustomerNotificationPreferences(id, { notificationConsent: event.target.value, consentSource: 'Customer account screen' }); setData(current => ({ ...current, customer: updated })); setNotice(t.notificationPreferenceSaved || 'Notification preference saved.'); } catch (e) { setError(e.message); } }
  return (
    <>
      {notice && <div className="alert success no-print">{notice}</div>}
      <div className="page-heading no-print">
        <div>
          <Link className="back-link" to="/customers"><ArrowLeft size={16} /> {t.backToCustomers}</Link>
          <h1>{customer.name}</h1>
          <p className="muted">{customer.customerNo} · {customer.phone}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="button primary" onClick={sendSummary} disabled={busy || customer.notificationConsent !== 'opted_in'} title={customer.notificationConsent !== 'opted_in' ? (t.customerConsentRequired || 'Customer opt-in is required') : ''}><Send size={16} /> {busy ? (t.loading || 'Loading…') : (t.sendAccountSummary || 'Queue account summary')}</button>
          <button className="button" onClick={() => window.print()}><Printer size={16} /> {t.printLedger}</button>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">{t.invoiceTotal}</span><div className="stat-value">{money(summary.invoiceTotal)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.invoiceOutstanding}</span><div className="stat-value">{money(summary.invoiceOutstanding)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.moneyReceipts}</span><div className="stat-value">{money(summary.moneyReceipts)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.dueAdjustments}</span><div className="stat-value">{money(summary.dueAdjustments)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.cashRefunds || 'Cash refunds'}</span><div className="stat-value">{money(summary.cashRefunds)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.grandDue}</span><div className="stat-value">{money(summary.grandDue)}</div></div>
      </div>
      <section className="panel no-print" style={{ marginBottom: 16 }}>
        <div className="panel-head"><div><h2>{t.notificationPreferences || 'Notification preferences'}</h2><p className="muted">{t.notificationPreferencesHint || "Choose the customer’s preferred delivery channel and record consent."}</p></div></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="notify-channel">{t.notifyChannel || 'Channel'}</label><select id="notify-channel" value={customer.notifyChannel || 'auto'} onChange={saveChannel}><option value="auto">{t.autoChannel || 'Auto (WhatsApp first)'}</option><option value="whatsapp">{t.whatsappChannel || 'WhatsApp'}</option><option value="sms">{t.smsChannel || 'SMS'}</option></select></div>
          <div className="field"><label htmlFor="notification-consent">{t.notificationConsent || 'Customer consent'}</label><select id="notification-consent" value={customer.notificationConsent || 'unknown'} onChange={saveConsent}><option value="unknown">{t.consentUnknown || 'Unknown'}</option><option value="opted_in">{t.consentOptIn || 'Opted in'}</option><option value="opted_out">{t.consentOptOut || 'Opted out'}</option></select></div>
          <div className="field"><label htmlFor="notification-language">{t.notificationLanguage || 'Message language'}</label><select id="notification-language" value={customer.preferredLanguage || 'en'} onChange={saveLanguage}><option value="en">English</option><option value="bn">বাংলা</option></select></div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>{t.customerHistory}</h2><p className="muted">{t.transactionsSeparate}</p></div></div>
        <div className="table-wrap">
          <table><thead><tr><th>{t.transactionType}</th><th>{t.document}</th><th>{t.dateTime}</th><th className="right">{t.total}</th><th className="right">{t.invoiceDueSettlement}</th></tr></thead>
            <tbody>{transactions.map(row => <tr key={`${row.type}-${row.id}`}>
              <td><span className={`status ${row.type === 'invoice' ? 'paid' : row.type === 'sales_return' ? 'partial' : 'unpaid'}`}>{row.type === 'invoice' ? t.invoiceType : row.type === 'money_receipt' ? t.moneyReceiptType : t.salesReturnType}</span></td>
              <td>{row.type === 'invoice' ? <Link className="invoice-link" to={`/invoices/${row.id}`}>{row.number}</Link> : row.number}</td>
              <td>{new Date(row.date).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
              <td className="right amount">{money(row.amount)}</td>
              <td className="right">{row.type === 'invoice' ? money(row.due) : row.type === 'sales_return' ? (['due_adjustment', 'customer_credit'].includes(row.settlementType) ? t.dueAdjusted : t.refunded) : '—'}</td>
            </tr>)}
            {!transactions.length && <tr><td colSpan="5" className="empty-cell"><ReceiptText size={24}/><p>{t.noTransactions}</p></td></tr>}</tbody>
          </table>
        </div>
      </section>
      <section className="panel no-print">
        <div className="panel-head"><div><h2>{t.notificationHistory || 'Notification history'}</h2><p className="muted">{t.notificationHistoryHint || 'Recent customer notification attempts and delivery status.'}</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>{t.dateTime}</th><th>{t.document}</th><th>{t.notifyChannel || 'Channel'}</th><th>{t.status}</th></tr></thead><tbody>
          {notifications.map(item => <tr key={item._id}><td>{new Date(item.createdAt).toLocaleString(locale)}</td><td>{item.eventType}</td><td>{item.channel || item.channelPreference}</td><td><span className={`status ${item.status === 'sent' || item.status === 'delivered' ? 'paid' : item.status === 'failed' ? 'unpaid' : 'partial'}`}>{item.status}</span></td></tr>)}
          {!notifications.length && <tr><td colSpan="4" className="empty-cell">{t.noNotificationHistory || 'No notification history yet.'}</td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}
