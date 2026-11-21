import { useEffect, useState } from 'react';
import { ReceiptText, Save, Store } from 'lucide-react';
import { api } from '../services/api.js';

const initialForm = {
  businessName: 'My POS Store', address: '', phone: '', currency: '৳',
  taxRate: 0, invoiceFooter: 'Thank you for your business!', notifications: { invoiceCreated: true, salesReturnCreated: true, moneyReceiptCreated: true }
};

export default function Settings({ t, onSaved }) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings().then(setForm).catch(requestError => setError(requestError.message));
  }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const saved = await api.updateSettings({ ...form, taxRate: Number(form.taxRate) || 0 });
      setForm(saved);
      onSaved(saved);
      setMessage(t.saved);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{t.preferences}</div><h1>{t.storeSettings}</h1><p className="muted">{t.settingsHint}</p></div>
    </div>
    {message && <div className="alert success">{message}</div>}
    {error && <div className="alert error">{error}</div>}
    <form onSubmit={save} className="settings-layout">
      <section className="panel form-panel">
        <div className="panel-title"><span className="settings-icon"><Store size={18}/></span><div><h2>{t.businessInformation}</h2><p className="muted">{t.printedOnInvoice}</p></div></div>
        <div className="form-stack">
          <div className="field"><label>{t.businessName} *</label><input required value={form.businessName || ''} onChange={event => setForm({ ...form, businessName: event.target.value })}/></div>
          <div className="field"><label>{t.address}</label><textarea rows="2" value={form.address || ''} onChange={event => setForm({ ...form, address: event.target.value })}/></div>
          <div className="form-grid">
            <div className="field"><label>{t.phone}</label><input value={form.phone || ''} onChange={event => setForm({ ...form, phone: event.target.value })}/></div>
            <div className="field"><label>{t.currency}</label><input value={form.currency || ''} onChange={event => setForm({ ...form, currency: event.target.value })}/></div>
            <div className="field"><label>{t.defaultTaxRate}</label><input type="number" min="0" step="0.01" value={form.taxRate} onChange={event => setForm({ ...form, taxRate: event.target.value })}/></div>
          </div>
        </div>
      </section>
      <section className="panel form-panel">
        <div className="panel-title"><span className="settings-icon"><ReceiptText size={18}/></span><div><h2>{t.invoicePreferences}</h2><p className="muted">{t.invoicePreferencesHint}</p></div></div>
        <div className="form-stack">
          <div className="field"><label>{t.footer}</label><textarea rows="3" value={form.invoiceFooter || ''} onChange={event => setForm({ ...form, invoiceFooter: event.target.value })}/><small className="field-help">{t.footerHelp}</small></div>
          <div className="settings-preview">
            <div className="preview-label">{t.livePreview}</div>
            <strong>{form.businessName || 'My POS Store'}</strong>
            <p>{form.address || t.businessAddress}</p>
            <p>{form.phone || t.phoneNumber} · {t.currencyLabel}: {form.currency || '৳'}</p>
            <div className="preview-line"/>
            <small>{form.invoiceFooter}</small>
          </div>
          <button className="button primary" disabled={busy}><Save size={17}/>{busy ? t.loading : t.save}</button>
        </div>
      </section>
      <section className="panel form-panel">
        <div className="panel-title"><span className="settings-icon"><ReceiptText size={18}/></span><div><h2>{t.notificationSettings || 'Customer notifications'}</h2><p className="muted">{t.notificationSettingsHint || 'Enable or disable automatic customer notifications.'}</p></div></div>
        <div className="form-stack">
          {[
            ['invoiceCreated', t.notifyInvoice || 'Invoice created'],
            ['salesReturnCreated', t.notifyReturn || 'Sales return'],
            ['moneyReceiptCreated', t.notifyReceipt || 'Money receipt']
          ].map(([key, label]) => <label className="field" key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" checked={form.notifications?.[key] !== false} onChange={event => setForm({ ...form, notifications: { ...form.notifications, [key]: event.target.checked } })}/>
            <span>{label}</span>
          </label>)}
          <small className="field-help">{t.notificationsGatewayHint || 'Messages are queued. Delivery requires the notification worker and a configured channel provider.'}</small>
          <button className="button primary" disabled={busy}><Save size={17}/>{busy ? t.loading : t.save}</button>
        </div>
      </section>
    </form>
  </>;
}
