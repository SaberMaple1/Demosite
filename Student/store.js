/*===== Shared storage: the SAME keys the admin portal uses  */
const K={food:'pickagoLiveFood',orders:'pickagoLiveOrders',acc:'pickagoStudentAccounts',ses:'pickagoStudentSession'};
const rd=(k,f)=>{
  try{const v=JSON.parse(localStorage.getItem(k));return v??f}catch{return f}
};
const wr=(k,v)=>{
  try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}
};
const foods=()=>(rd(K.food,[])||[]).filter(f=>f&&f.name).map(f=>({emoji:'🍽️',desc:'',image:'',...f,price:+f.price||0,stock:Math.max(0,+f.stock||0)}));
const accounts=()=>{
  const a=rd(K.acc,[]);return Array.isArray(a)?a:[]
};
const me=()=>accounts().find(a=>a.email===localStorage.getItem(K.ses))||null;
const updateMe=(patch)=>{
  const m=me();if(!m)return false;return wr(K.acc,accounts().map(a=>a.email===m.email?{...a,...patch}:a))
  };
const myOrders=()=>{
  const m=me();return m?(rd(K.orders,[])||[]).filter(o=>o.studentId===m.email):[]
};

const S={view:'login',page:'menu',cat:'All',q:'',cart:[],note:'',tab:'info',receipt:null,sig:'',seen:{},lock:0,fails:0,idleAt:Date.now(),showLrn:false};

/*  Cart (stock is only taken when the order is placed)  */
function cartLines(){const f=foods();return S.cart.map(c=>{const x=f.find(i=>i.id===c.id);return x?{...x,qty:Math.min(c.qty,x.stock)}:null}).filter(l=>l&&l.qty>0)}
const total=()=>cartLines().reduce((s,l)=>s+l.qty*l.price,0);
const cartN=()=>cartLines().reduce((s,l)=>s+l.qty,0);
function addCart(id,d){const f=foods().find(x=>x.id===id);if(!f)return;let c=S.cart.find(x=>x.id===id);if(!c){c={id,qty:0};S.cart.push(c)}
  if(d>0&&c.qty>=f.stock)return toast(`Only ${f.stock} left of ${f.name}`,1);c.qty+=d;if(c.qty<=0)S.cart=S.cart.filter(x=>x!==c);if(d>0)toast('Added to cart');render()}

function placeOrder(){
  const m=me();const lines=cartLines();if(!m||!lines.length)return;
  const food=rd(K.food,[]);const orders=rd(K.orders,[])||[];   // re-read: never overwrite admin changes
  for(const l of lines){const f=food.find(x=>x.id===l.id);if(!f||(+f.stock||0)<l.qty){toast(`${l.name} just ran low. Your cart was updated.`,1);return render()}}
  lines.forEach(l=>{const f=food.find(x=>x.id===l.id);f.stock=(+f.stock||0)-l.qty});
  const max=Math.max(0,...orders.map(o=>+String(o.id||'').replace(/\D/g,'')||0));
  const now=new Date();
  const o={id:'#'+String(max+1).padStart(3,'0'),studentId:m.email,student:m.name,createdAt:now.toISOString(),
    date:new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short'}).format(now),status:'Pending',
    items:lines.map(l=>({name:l.name,qty:l.qty,price:l.price})),note:S.note.trim(),total:total()};
  orders.unshift(o);
  if(!wr(K.food,food)||!wr(K.orders,orders))return toast('Could not save the order. Try again.',1);
  S.cart=[];S.note='';S.receipt=o.id;S.page='receipt';S.sig=sig();toast('Order placed! The canteen can see it now.');render();
}

function reorder(id){
  const o=myOrders().find(x=>x.id===id);if(!o)return;const f=foods();let n=0;
  o.items.forEach(i=>{const x=f.find(y=>y.name===i.name);if(x&&x.stock>0){S.cart.push({id:x.id,qty:Math.min(i.qty,x.stock)});n++}});
  toast(n?`${n} item${n>1?'s':''} added to your cart`:'Those items are unavailable right now',!n);if(n){S.page='cart'}render()
}
