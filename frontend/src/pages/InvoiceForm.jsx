import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save, ChevronDown } from 'lucide-react';
import { api } from '../services/api.js';

const blankItem = () => ({ product: '', name: '', sku: '', quantity: 1, unitPrice: 0, batchId: '' });
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const initialForm = settings => ({
  customerName: '', customerPhone: '', customerAddress: '', notifyChannel: 'auto', notificationConsent: 'unknown', preferredLanguage: 'en', items: [blankItem()],
  discountType: 'fixed', discountValue: '0', discount: 0,
  taxRate: String(settings?.taxRate ?? 0), notes: '',
  invoiceDate: new Date().toISOString().slice(0, 10),
  paidAmount: '', paymentType: 'cash', cashAmount: '', banglaQrAmount: ''
});

function ProductPicker({ item, products, onSelect, onSearch, invalid, t }) {
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedText = item.name ? `${item.name}${item.sku ? ` · ${item.sku}` : ''}` : '';

  function openPicker() {
    setOpen(true);
    setQuery('');
    onSearch('');
  }

  function closePicker() {
    setOpen(false);
    setQuery('');
    onSearch('');
  }

  return (
    <div className="field item-product product-picker" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) closePicker();
    }}>
      <label>{t.product}</label>
      <div className="product-picker-control">
        <input
          type="text"
          role="combobox"
          aria-label={t.searchProductsByNameCode}
          aria-expanded={open}
          aria-controls={optionsId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          autoComplete="off"
          value={open ? query : selectedText}
          placeholder={t.chooseProduct}
          onFocus={openPicker}
          onClick={() => { if (!open) openPicker(); }}
          onChange={event => {
            const value = event.target.value;
            setQuery(value);
            if (!open) setOpen(true);
            onSearch(value);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') closePicker();
            if (event.key === 'Enter' && open && products.length === 1) {
              event.preventDefault();
              onSelect(products[0]);
              closePicker();
            }
          }}
        />
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      {open && (
        <div className="product-picker-options" id={optionsId} role="listbox">
          {products.length ? products.map(product => (
            <button
              type="button"
              className="product-picker-option"
              role="option"
              aria-selected={String(item.product) === String(product._id)}
              key={product._id}
              onPointerDown={event => event.preventDefault()}
              onClick={() => { onSelect(product); closePicker(); }}
            >
              <span>
                <strong>{product.name}</strong>
                <small>{[product.sku, product.barcode].filter(Boolean).join(' · ')}</small>
              </span>
              <span className="product-picker-stock">{t.stock}: {product.branchQuantity}</span>
            </button>
          )) : <div className="product-picker-empty">{t.noMatchingProducts}</div>}
        </div>
      )}
    </div>
  );
}

export default function InvoiceForm({ t, settings, lang }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [batchOptions, setBatchOptions] = useState({});
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('pos-user') || 'null'); }
    catch { return null; }
  }, []);
  const isOwner = currentUser?.role === 'owner';
  const [form, setForm] = useState(() => initialForm(settings));
  const [error, setError] = useState('');
  const [stockErrorProduct, setStockErrorProduct] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.inventory(productSearch.trim())
        .then(rows => {
          if (!active) return;
          setProducts(rows
            .filter(row => row.productId?.active !== false && row.productId)
            .map(row => ({ ...row.productId, branchQuantity: row.quantity })));
        })
        .catch(e => { if (active) setError(e.message); });
    }, productSearch.trim() ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [productSearch]);

  useEffect(() => {
    if (id && !isOwner) {
      setError(t.ownerOnlyInvoiceEdit);
      return;
    }
    if (!id) return;

    let active = true;
    api.invoice(id).then(invoice => {
      if (!active) return;
      setForm({
        ...initialForm(settings), ...invoice,
        invoiceDate: new Date(invoice.invoiceDate).toISOString().slice(0, 10),
        items: invoice.items.map(item => ({ ...item, product: item.product || '' })),
        discountType: invoice.discountType || 'fixed',
        discountValue: String(invoice.discountValue ?? invoice.discount ?? 0),
        taxRate: String(invoice.taxRate ?? 0),
        paidAmount: String(invoice.paidAmount ?? 0),
        paymentType: invoice.paymentType || 'cash',
        cashAmount: String(invoice.cashAmount ?? 0),
        banglaQrAmount: String(invoice.banglaQrAmount ?? 0)
      });
      [...new Set(invoice.items.map(item => String(item.product)))].forEach(productId => {
        api.batches(productId)
          .then(rows => { if (active) setBatchOptions(current => ({ ...current, [productId]: rows })); })
          .catch(() => {});
      });
    }).catch(e => { if (active) setError(e.message); });

    return () => { active = false; };
  }, [id, isOwner]);

  useEffect(() => {
    if (!id && settings?.taxRate !== undefined) {
      setForm(current => ({
        ...current,
        taxRate: current.taxRate === '0' || current.taxRate === '' ? String(settings.taxRate) : current.taxRate
      }));
    }
  }, [settings?.taxRate, id]);

  const subtotal = useMemo(() => roundMoney(form.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0
  )), [form.items]);
  const discountValue = form.discountValue === '' ? 0 : Number(form.discountValue);
  const discountType = form.discountType || 'fixed';
  const discount = roundMoney(discountType === 'percentage'
    ? subtotal * (Number.isFinite(discountValue) ? discountValue : 0) / 100
    : (Number.isFinite(discountValue) ? discountValue : 0));
  const taxRate = form.taxRate === '' ? 0 : Number(form.taxRate);
  const taxAmount = roundMoney(Math.max(0, subtotal - discount) * (Number.isFinite(taxRate) ? taxRate : 0) / 100);
  const total = roundMoney(Math.max(0, subtotal - discount + taxAmount));
  const paidAmount = form.paidAmount === '' ? 0 : Number(form.paidAmount);
  const cashAmount = form.paymentType === 'cash'
    ? (Number.isFinite(paidAmount) ? paidAmount : 0)
    : form.paymentType === 'mixed' ? Number(form.cashAmount || 0) : 0;
  const banglaQrAmount = form.paymentType === 'bangla_qr'
    ? (Number.isFinite(paidAmount) ? paidAmount : 0)
    : form.paymentType === 'mixed' ? Number(form.banglaQrAmount || 0) : 0;
  const paymentMatches = Number.isFinite(paidAmount) &&
    Number.isFinite(cashAmount) && Number.isFinite(banglaQrAmount) &&
    Math.round(roundMoney(cashAmount + banglaQrAmount) * 100) === Math.round(roundMoney(paidAmount) * 100);
  const discountValid = Number.isFinite(discountValue) && discountValue >= 0 &&
    (discountType === 'percentage' ? discountValue <= 100 : discount <= subtotal);
  const taxValid = Number.isFinite(taxRate) && taxRate >= 0;
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function updateItem(index, key, value) {
    setError('');
    setStockErrorProduct('');
    setForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
    }));
  }

  async function chooseProduct(index, product) {
    if (!product?._id) return;
    setStockErrorProduct('');
    setError('');
    try {
      const availableBatches = await api.batches(product._id);
      setBatchOptions(current => ({ ...current, [product._id]: availableBatches }));
      const firstBatch = availableBatches[0];
      setForm(current => ({
        ...current,
        items: current.items.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          product: product._id,
          name: product.name,
          sku: product.sku || '',
          quantity: item.quantity || 1,
          unitPrice: firstBatch?.sellingPrice ?? product.price,
          batchId: ''
        } : item)
      }));
    } catch (e) { setError(e.message); }
  }

  function chooseBatch(index, batchId) {
    const item = form.items[index];
    const batch = (batchOptions[item.product] || []).find(row => row._id === batchId);
    setForm(current => ({
      ...current,
      items: current.items.map((row, itemIndex) => itemIndex === index
        ? { ...row, batchId, ...(batch ? { unitPrice: batch.sellingPrice } : {}) }
        : row)
    }));
  }

  async function lookupCustomer() {
    const phone = form.customerPhone.trim();
    if (!phone) return;
    try {
      const result = await api.findCustomer(phone);
      if (result.found) {
        setForm(current => ({
          ...current,
          customerName: result.customer.name,
          customerPhone: result.customer.phone,
          customerAddress: result.customer.address || '',
          notifyChannel: result.customer.notifyChannel || 'auto',
          notificationConsent: result.customer.notificationConsent || 'unknown',
          preferredLanguage: result.customer.preferredLanguage || 'en'
        }));
        setCustomerMessage(t.existingCustomerFound.replace('{number}', result.customer.customerNo));
      } else setCustomerMessage(t.newCustomerMessage);
    } catch (e) { setCustomerMessage(e.message); }
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setStockErrorProduct('');
    if (!form.items.length || form.items.some(item => !item.product || !item.name || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) {
      setError(t.noItems);
      return;
    }
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError(t.customerNamePhoneRequired);
      return;
    }
    if (!id && form.paidAmount === '') {
      setError(t.initialPaymentRequired);
      return;
    }
    if (!id && (!Number.isFinite(paidAmount) || paidAmount < 0)) {
      setError(t.invalidInitialPayment);
      return;
    }
    if (!discountValid) {
      setError(t.invalidDiscount);
      return;
    }
    if (!taxValid) {
      setError(t.invalidTax);
      return;
    }
    if (id && revisionReason.trim().length < 5) {
      setError(t.editReasonRequired);
      return;
    }
    if (!id && paidAmount > total) {
      setError(t.paymentExceedsTotal);
      return;
    }
    if (!id && !paymentMatches) {
      setError(t.paymentSplitMismatch);
      return;
    }

    setBusy(true);
    try {
      const body = {
        ...form,
        items: form.items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          ...(isOwner && item.batchId ? { batchId: item.batchId } : {})
        })),
        discountType,
        discountValue: Number(discountValue) || 0,
        discount,
        taxRate: Number(taxRate) || 0,
        ...(id
          ? { revisionReason: revisionReason.trim() }
          : { paidAmount: roundMoney(paidAmount), cashAmount: roundMoney(cashAmount), banglaQrAmount: roundMoney(banglaQrAmount) })
      };
      const saved = id ? await api.updateInvoice(id, body) : await api.createInvoice(body);
      navigate(`/invoices/${saved._id}`);
    } catch (e) {
      setError(e.message);
      setStockErrorProduct(e.code === 'INSUFFICIENT_STOCK' ? e.productName : '');
    }
    finally { setBusy(false); }
  }

  if (id && !isOwner) return <div className="alert error">{t.ownerOnlyInvoiceEdit}</div>;

  return (
    <>
      <div className="page-heading">
        <div>
          <button className="back-link" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16}/>{t.back}</button>
          <h1>{id ? t.editInvoice : t.createInvoice}</h1>
          <p className="muted">{t.invoiceFormDescription}</p>
        </div>
      </div>
      {error && (stockErrorProduct ? (
        <div className="invoice-stock-toast alert error" role="alert" aria-live="assertive">
          <span>{error}</span>
          <button type="button" className="icon-button" aria-label={t.close} onClick={() => { setError(''); setStockErrorProduct(''); }}>×</button>
        </div>
      ) : <div className="alert error" role="alert">{error}</div>)}
      <form onSubmit={save} className="invoice-layout">
        <div className="form-main">
          <section className="panel form-panel">
            <div className="panel-title">
              <span className="section-number">01</span>
              <div><h2>{t.customer}</h2><p className="muted">{t.customerPhoneHint}</p></div>
            </div>
            <div className="form-grid three">
              <div className="field">
                <label htmlFor="customer-phone">{t.customerPhone} *</label>
                <input id="customer-phone" value={form.customerPhone || ''} onChange={e => setForm(current => ({ ...current, customerPhone: e.target.value }))} onBlur={lookupCustomer} placeholder="01XXXXXXXXX" required />
              </div>
              <div className="field">
                <label htmlFor="customer-name">{t.customerName} *</label>
                <input id="customer-name" value={form.customerName || ''} onChange={e => setForm(current => ({ ...current, customerName: e.target.value }))} required />
              </div>
              <div className="field">
                <label htmlFor="invoice-date">{t.invoiceDate}</label>
                <input id="invoice-date" type="date" value={form.invoiceDate} onChange={e => setForm(current => ({ ...current, invoiceDate: e.target.value }))}/>
              </div>
              <div className="field span-all">
                <label htmlFor="customer-address">{t.customerAddress}</label>
                <input id="customer-address" value={form.customerAddress || ''} onChange={e => setForm(current => ({ ...current, customerAddress: e.target.value }))}/>
              </div>
            </div>
            {!id && <div className="form-grid three notification-checkout-fields">
              <div className="field"><label htmlFor="checkout-notify-channel">{t.notifyChannel || 'Preferred channel'}</label><select id="checkout-notify-channel" value={form.notifyChannel} onChange={e => setForm(current => ({ ...current, notifyChannel: e.target.value }))}><option value="auto">{t.autoChannel || 'Auto (WhatsApp first)'}</option><option value="whatsapp">{t.whatsappChannel || 'WhatsApp'}</option><option value="sms">{t.smsChannel || 'SMS'}</option></select></div>
              <div className="field"><label htmlFor="checkout-notify-consent">{t.notificationConsent || 'Customer consent'}</label><select id="checkout-notify-consent" value={form.notificationConsent} onChange={e => setForm(current => ({ ...current, notificationConsent: e.target.value }))}><option value="unknown">{t.consentUnknown || 'Not confirmed'}</option><option value="opted_in">{t.consentOptIn || 'Agreed to notifications'}</option><option value="opted_out">{t.consentOptOut || 'Does not want notifications'}</option></select></div>
              <div className="field"><label htmlFor="checkout-notify-language">{t.notificationLanguage || 'Message language'}</label><select id="checkout-notify-language" value={form.preferredLanguage} onChange={e => setForm(current => ({ ...current, preferredLanguage: e.target.value }))}><option value="en">English</option><option value="bn">বাংলা</option></select></div>
            </div>}
            {customerMessage && <p className="field-help" role="status">{customerMessage}</p>}
            {id && <div className="field invoice-revision-reason">
              <label htmlFor="revision-reason">{t.editReason} *</label>
              <textarea id="revision-reason" rows="3" value={revisionReason} onChange={e => setRevisionReason(e.target.value)} minLength={5} maxLength={1000} placeholder={t.editReasonPlaceholder} required />
            </div>}
          </section>

          <section className="panel form-panel invoice-products-panel">
            <div className="panel-title">
              <span className="section-number">02</span>
              <div><h2>{t.items}</h2><p className="muted">{t.branchProductsHint}</p></div>
              <button type="button" className="button primary compact push-right" onClick={() => setForm(current => ({ ...current, items: [...current.items, blankItem()] }))}><Plus size={15}/>{t.addItem}</button>
            </div>
            <div className="invoice-items">
              {form.items.map((item, index) => (
                <div className={`invoice-item ${stockErrorProduct && item.name === stockErrorProduct ? 'stock-error' : ''}`} key={index}>
                  <div className="item-index">{String(index + 1).padStart(2, '0')}</div>
                  <ProductPicker
                    item={item}
                    products={products}
                    onSearch={setProductSearch}
                    onSelect={product => chooseProduct(index, product)}
                    invalid={stockErrorProduct && item.name === stockErrorProduct}
                    t={t}
                  />
                  {isOwner && item.product ? (
                    <div className="field item-batch">
                      <label htmlFor={`batch-${index}`}>{t.manualBatchOverride}</label>
                      <select id={`batch-${index}`} value={item.batchId || ''} onChange={e => chooseBatch(index, e.target.value)}>
                        <option value="">{t.fifoOldestFirst}</option>
                        {(batchOptions[item.product] || []).map(batch => (
                          <option key={batch._id} value={batch._id}>{batch.batchNo} · {t.available}: {batch.quantity} · {t.sellingPrice}: {money(batch.sellingPrice)}</option>
                        ))}
                      </select>
                    </div>
                  ) : <div className="item-batch-spacer" aria-hidden="true" />}
                  <div className="field item-qty">
                    <label htmlFor={`quantity-${index}`}>{t.quantity}</label>
                    <input id={`quantity-${index}`} type="number" min="0.01" step="0.01" required value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)}/>
                  </div>
                  <div className="field item-price">
                    <label htmlFor={`price-${index}`}>{t.price}</label>
                    <input id={`price-${index}`} type="number" min="0" step="0.01" required value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', e.target.value)}/>
                  </div>
                  <div className="item-total"><small>{t.lineSubtotal}</small><strong>{money(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</strong></div>
                  <button type="button" className="icon-button danger remove-item" aria-label={`${t.remove} ${item.name || t.item}`} title={t.remove} disabled={form.items.length === 1} onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel form-panel">
            <div className="panel-title">
              <span className="section-number">03</span>
              <div>
                <h2>{id ? t.originalPaymentLocked : t.initialPayment}</h2>
                <p className="muted">{id ? t.invoiceEditPaymentHint : t.initialPaymentDescription}</p>
              </div>
            </div>
            {id ? (
              <div className="alert success">{t.originalPaymentSummary}: {money(form.paidAmount)} · {t.cash}: {money(form.cashAmount)} · {t.banglaQr}: {money(form.banglaQrAmount)}. {t.paymentRemainsUnchanged}</div>
            ) : (
              <>
                <div className="form-grid three">
                  <div className="field">
                    <label htmlFor="initial-payment">{t.amountPaidNow} *</label>
                    <input id="initial-payment" type="number" min="0" max={total} step="0.01" value={form.paidAmount} onChange={e => setForm(current => ({ ...current, paidAmount: e.target.value }))} required aria-describedby="initial-payment-help" />
                    <small id="initial-payment-help" className="field-help">{t.zeroPaymentAllowed}</small>
                  </div>
                  <div className="field">
                    <label htmlFor="payment-method">{t.paymentMethod}</label>
                    <select id="payment-method" value={form.paymentType} onChange={e => setForm(current => ({ ...current, paymentType: e.target.value, cashAmount: '', banglaQrAmount: '' }))}>
                      <option value="cash">{t.cash}</option>
                      <option value="bangla_qr">{t.banglaQr}</option>
                      <option value="mixed">{t.mixedPayment}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="remaining-due">{t.remainingDue}</label>
                    <input id="remaining-due" readOnly value={money(Math.max(0, total - (Number.isFinite(paidAmount) ? paidAmount : 0)))}/>
                  </div>
                </div>
                {form.paymentType === 'mixed' ? (
                  <div className="mixed-payment-box">
                    <h3>{t.mixedPayment}</h3>
                    <p className="muted">{t.mixedPaymentHint}</p>
                    <div className="form-grid">
                      <div className="field"><label htmlFor="mixed-cash">{t.cash}</label><input id="mixed-cash" type="number" min="0" step="0.01" value={form.cashAmount} onChange={e => setForm(current => ({ ...current, cashAmount: e.target.value }))}/></div>
                      <div className="field"><label htmlFor="mixed-qr">{t.banglaQr}</label><input id="mixed-qr" type="number" min="0" step="0.01" value={form.banglaQrAmount} onChange={e => setForm(current => ({ ...current, banglaQrAmount: e.target.value }))}/></div>
                    </div>
                    <div className="mixed-total"><strong>{t.totalCollected}</strong><strong>{money(cashAmount + banglaQrAmount)}</strong></div>
                    <span className={`payment-match ${paymentMatches ? 'valid' : 'invalid'}`}>{paymentMatches ? t.paymentAmountsMatch : `${t.difference}: ${money(paidAmount - cashAmount - banglaQrAmount)}`}</span>
                  </div>
                ) : <div className="alert success">{form.paymentType === 'cash' ? t.cash : t.banglaQr}: {money(paidAmount)}</div>}
              </>
            )}
            <div className="field"><label htmlFor="invoice-notes">{t.notes}</label><textarea id="invoice-notes" rows="2" value={form.notes || ''} onChange={e => setForm(current => ({ ...current, notes: e.target.value }))}/></div>
          </section>
        </div>

        <aside className="panel totals-panel">
          <div className="totals-heading"><span className="totals-icon"><Save size={18}/></span><div><h2>{t.invoiceDetails}</h2><p className="muted">{t.liveCalculation}</p></div></div>
          <div className="totals-row"><span>{t.subtotal}</span><strong>{money(subtotal)}</strong></div>
          <div className="totals-input-row">
            <div className="field">
              <label htmlFor="discount-type">{t.discountType}</label>
              <div className="totals-edit-control">
                <select id="discount-type" value={discountType} onChange={e => setForm(current => ({ ...current, discountType: e.target.value }))}>
                  <option value="fixed">{t.fixedAmount}</option>
                  <option value="percentage">{t.percentage}</option>
                </select>
                <input id="discount-value" aria-label={t.discountValue} type="number" min="0" max={discountType === 'percentage' ? 100 : subtotal} step="0.01" value={form.discountValue} onChange={e => setForm(current => ({ ...current, discountValue: e.target.value }))}/>
              </div>
              {!discountValid && <small className="field-error">{t.invalidDiscount}</small>}
            </div>
            <strong className="totals-calculated-value">− {money(discount)}</strong>
          </div>
          <div className="totals-input-row">
            <div className="field">
              <label htmlFor="tax-rate">{t.taxRate}</label>
              <input id="tax-rate" aria-label={t.taxRate} type="number" min="0" step="0.01" value={form.taxRate} onChange={e => setForm(current => ({ ...current, taxRate: e.target.value }))}/>
              {!taxValid && <small className="field-error">{t.invalidTax}</small>}
            </div>
            <strong className="totals-calculated-value">{money(taxAmount)}</strong>
          </div>
          <div className="totals-grand"><span>{t.total}</span><strong>{money(total)}</strong></div>
          <p className="muted totals-note">{t.taxAfterDiscount}</p>
          <button className="button primary full" disabled={busy || (!id && !paymentMatches) || !discountValid || !taxValid}><Save size={17}/>{busy ? t.loading : id ? t.updateInvoice : t.save}</button>
          <button type="button" className="button secondary full" onClick={() => navigate(-1)}>{t.cancel}</button>
        </aside>
      </form>
    </>
  );
}
