const C=window.STORE_CONFIG,P=window.PRODUCTS;let cart=JSON.parse(localStorage.getItem('ksnCart')||'[]');const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);function save(){localStorage.setItem('ksnCart',JSON.stringify(cart));renderCart()}function totals(){const subtotal=cart.reduce((a,x)=>a+x.price*x.qty,0),delivery=subtotal>=C.freeDeliveryAbove||!subtotal?0:C.deliveryFee;return{subtotal,delivery,total:subtotal+delivery}}function toast(msg){const t=$('[data-toast]');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}function add(id){const p=P.find(x=>x.id===id),x=cart.find(x=>x.id===id);if(!p)return;x?x.qty++:cart.push({...p,qty:1});save();toast(`${p.name} added to cart`)}function change(id,d){const x=cart.find(x=>x.id===id);if(!x)return;x.qty+=d;if(x.qty<=0)cart=cart.filter(y=>y.id!==id);save()}function renderCart(){const count=cart.reduce((a,x)=>a+x.qty,0);$$('[data-cart-count]').forEach(e=>e.textContent=count);const box=$('[data-cart-items]');if(box)box.innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><div><strong>${x.name}</strong><div>${money(x.price)} / ${x.unit}</div><div class="qty-controls"><button data-dec="${x.id}">−</button><span>${x.qty}</span><button data-inc="${x.id}">+</button></div></div><button class="remove" data-remove="${x.id}">Remove</button></div>`).join(''):'<div class="empty-state">Your cart is empty. Add some fresh favourites.</div>';const t=totals();$$('[data-cart-total]').forEach(e=>e.textContent=money(t.subtotal));$$('[data-inc]').forEach(b=>b.onclick=()=>change(b.dataset.inc,1));$$('[data-dec]').forEach(b=>b.onclick=()=>change(b.dataset.dec,-1));$$('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);save()});renderCheckout()}function card(p){return `<article class="product-card" data-category="${p.category}" data-name="${p.name.toLowerCase()}"><div class="product-visual"><span class="product-badge">${p.badge}</span>${p.emoji}</div><div class="product-info"><div class="product-category">${p.category}</div><h3>${p.name}</h3><div class="rating">★ ${p.rating} · Freshly prepared</div><p>${p.description}</p><div class="product-footer"><span class="price">${money(p.price)}/${p.unit}</span><button class="add-btn" data-add="${p.id}">Add</button></div></div></article>`}function bindAdd(){$$('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add))}function renderFeatured(){const box=$('[data-featured-products]');if(box){box.innerHTML=P.slice(0,4).map(card).join('');bindAdd()}}function renderProducts(){const box=$('[data-product-grid]');if(!box)return;let category=$('.filter-btn.active')?.dataset.filter||'All',q=($('[data-search]')?.value||'').toLowerCase().trim();let list=P.filter(p=>(category==='All'||p.category===category)&&(!q||`${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)));box.innerHTML=list.length?list.map(card).join(''):'<div class="empty-state">No matching products found.</div>';bindAdd()}function openCart(){document.body.style.overflow='hidden';$('[data-cart-drawer]')?.classList.add('open');$('[data-cart-backdrop]')?.classList.add('open')}function closeCart(){document.body.style.overflow='';$('[data-cart-drawer]')?.classList.remove('open');$('[data-cart-backdrop]')?.classList.remove('open')}function renderCheckout(){const box=$('[data-order-summary]');if(!box)return;const t=totals();box.innerHTML=cart.length?cart.map(x=>`<div class="summary-row"><span>${x.name} × ${x.qty}</span><strong>${money(x.price*x.qty)}</strong></div>`).join(''):'<div class="notice">Your cart is empty. Add products before checkout.</div>';const sub=$('[data-subtotal]'),del=$('[data-delivery]'),tot=$('[data-grand-total]');if(sub)sub.textContent=money(t.subtotal);if(del)del.textContent=t.delivery?money(t.delivery):'FREE';if(tot)tot.textContent=money(t.total)}function setCheckoutStatus(message, isError=false){const box=$('[data-checkout-status]');if(!box)return;box.textContent=message;box.style.borderColor=isError?'#b42318':''}
let pendingUpiOrder=null;
async function checkout(e){
  e.preventDefault();
  if(!cart.length)return toast('Your cart is empty');
  const t=totals();
  if(t.subtotal<C.minimumOrder)return toast(`Minimum order is ${money(C.minimumOrder)}`);
  const d=Object.fromEntries(new FormData(e.target));
  if(!/^\d{10}$/.test(d.phone||''))return toast('Enter a valid 10-digit phone number');
  if(d.fulfilment==='Delivery'&&!d.address?.trim())return toast('Enter a delivery address');
  const payButton=$('[data-pay-button]');
  payButton.disabled=true;payButton.textContent='Creating order...';
  setCheckoutStatus('Creating your order and payment QR...');
  try{
    const response=await fetch(`${C.apiBaseUrl}/api/orders`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({customer:{name:d.name,phone:d.phone,email:d.email||'',fulfilment:d.fulfilment,address:d.address||'',notes:d.notes||''},items:cart.map(x=>({id:x.id,qty:x.qty}))})
    });
    const order=await response.json();
    if(!response.ok)throw new Error(order.error||'Unable to create order');
    pendingUpiOrder=order;
    const box=$('[data-upi-payment-box]');
    if(box)box.style.display='block';
    $('[data-upi-amount]').textContent=money(order.amount);
    $('[data-upi-id]').textContent=order.upiId;
    $('[data-upi-qr]').src=order.qrCodeDataUrl;
    $('[data-upi-link]').href=order.upiUri;
    setCheckoutStatus(`Order ${order.orderId} created. Complete the UPI payment and submit the transaction reference.`);
    payButton.textContent='UPI payment details shown below';
    box?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){
    const message = error instanceof TypeError && /fetch/i.test(error.message)
      ? 'Backend connection failed. Start the server on http://localhost:4000 and confirm /api/health opens successfully.'
      : (error.message||'Unable to create order.');
    setCheckoutStatus(message,true);
    payButton.disabled=false;payButton.textContent='Create order & show UPI QR';
  }
}
async function confirmUpiPayment(){
  if(!pendingUpiOrder)return toast('Create your order first');
  const reference=($('[data-upi-reference]')?.value||'').trim();
  if(!/^[A-Za-z0-9-]{6,40}$/.test(reference))return toast('Enter a valid UPI transaction reference');
  const button=$('[data-confirm-upi]');
  button.disabled=true;button.textContent='Submitting...';
  setCheckoutStatus('Submitting your payment details for verification...');
  try{
    const response=await fetch(`${C.apiBaseUrl}/api/payments/upi-confirm`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({orderId:pendingUpiOrder.orderId,upiReference:reference})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Unable to submit payment details');
    cart=[];save();
    window.location.href=`payment-success.html?order=${encodeURIComponent(pendingUpiOrder.orderId)}`;
  }catch(error){
    const message = error instanceof TypeError && /fetch/i.test(error.message)
      ? 'Backend connection failed. Start the server on http://localhost:4000 and try again.'
      : (error.message||'Unable to submit payment details.');
    setCheckoutStatus(message,true);
    button.disabled=false;button.textContent='Submit payment details';
  }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-open-cart],[data-close-cart],[data-cart-backdrop]');if(!b)return;if(b.matches('[data-open-cart]'))openCart();else closeCart()});$('.menu-btn')?.addEventListener('click',()=>$('.nav')?.classList.toggle('open'));$$('.filter-btn').forEach(b=>b.onclick=()=>{$$('.filter-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderProducts()});$('[data-search]')?.addEventListener('input',renderProducts);$('#checkout-form')?.addEventListener('submit',checkout);$('[data-confirm-upi]')?.addEventListener('click',confirmUpiPayment);$$('[name="fulfilment"]').forEach(r=>r.addEventListener('change',()=>{const a=$('[data-address-field]');if(a)a.style.display=r.checked&&r.value==='Delivery'?'block':'none'}));$('[data-shop-phone]')?.setAttribute('href',`tel:+${C.phone}`);$$('[data-shop-phone-text]').forEach(e=>e.textContent=C.displayPhone);renderFeatured();renderProducts();renderCart();
