/*===== Shared data lives in Firebase. C is a live local copy of it. =====*/
const C={food:[],orders:[],me:null,ver:0};
let unsubs=[];
const bump=()=>{C.ver++};
const foods=()=>C.food.filter(f=>f&&f.name).map(f=>({emoji:'🍽️',desc:'',image:'',...f,price:+f.price||0,stock:Math.max(0,+f.stock||0)}));
const me=()=>C.me;
const updateMe=(patch)=>{
  if(!C.me)return false;
  C.me={...C.me,...patch};
  db.collection('students').doc(C.me.uid).set(patch,{merge:true}).catch(()=>toast('Could not save. Check your internet.',1));
  return true
};
const myOrders=()=>C.orders;
const sig=()=>C.ver;

function onData(){
  if(me()&&S.view!=='app'){
    S.view='app';S.page='menu';S.idleAt=Date.now();
    myOrders().forEach(o=>S.seen[o.id]=o.status);
    S.sig=sig();render();return
  }
  if(typeof sync==='function')sync()
}
function stopData(){unsubs.forEach(u=>u());unsubs=[]}
function startData(user){
  stopData();
  const bad=e=>console.error(e);
  unsubs.push(db.collection('food').onSnapshot(s=>{
    C.food=s.docs.map(d=>d.data()).sort((a,b)=>(+a.id||0)-(+b.id||0));bump();onData()},bad));
  unsubs.push(db.collection('orders').where('studentId','==',user.email).onSnapshot(s=>{
    C.orders=s.docs.map(d=>d.data()).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));bump();onData()},bad));
  unsubs.push(db.collection('students').doc(user.uid).onSnapshot(s=>{
    C.me=s.exists?{uid:user.uid,email:user.email,...s.data()}:null;bump();onData()},bad));
}

const S={view:'login',page:'menu',cat:'All',q:'',cart:[],note:'',tab:'info',receipt:null,sig:'',seen:{},lock:0,fails:0,idleAt:Date.now(),showLrn:false,busy:0};

/*  Cart (stock is only taken when the order is placed)  */
function cartLines(){const f=foods();return S.cart.map(c=>{const x=f.find(i=>i.id===c.id);return x?{...x,qty:Math.min(c.qty,x.stock)}:null}).filter(l=>l&&l.qty>0)}
const total=()=>cartLines().reduce((s,l)=>s+l.qty*l.price,0);
const cartN=()=>cartLines().reduce((s,l)=>s+l.qty,0);
function addCart(id,d){const f=foods().find(x=>x.id===id);if(!f)return;let c=S.cart.find(x=>x.id===id);if(!c){c={id,qty:0};S.cart.push(c)}
  if(d>0&&c.qty>=f.stock)return toast(`Only ${f.stock} left of ${f.name}`,1);c.qty+=d;if(c.qty<=0)S.cart=S.cart.filter(x=>x!==c);if(d>0)toast('Added to cart');render()}

async function placeOrder(){
  const m=me();const lines=cartLines();if(!m||!lines.length||S.busy)return;
  S.busy=1;
  try{
    const o=await db.runTransaction(async tx=>{
      const refs=lines.map(l=>db.collection('food').doc(String(l.id)));
      const snaps=await Promise.all(refs.map(r=>tx.get(r)));
      const ctr=db.collection('meta').doc('orderCounter');
      const cs=await tx.get(ctr);
      snaps.forEach((sn,i)=>{if(!sn.exists||(+sn.data().stock||0)<lines[i].qty)throw new Error('low:'+lines[i].name)});
      const n=(cs.exists?+cs.data().n||0:0)+1;
      const num=String(n).padStart(3,'0');
      snaps.forEach((sn,i)=>tx.update(refs[i],{stock:(+sn.data().stock||0)-lines[i].qty}));
      tx.set(ctr,{n});
      const now=new Date();
      const order={id:'#'+num,studentId:m.email,student:m.name,createdAt:now.toISOString(),
        date:new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short'}).format(now),status:'Pending',
        items:lines.map(l=>({name:l.name,qty:l.qty,price:l.price})),note:S.note.trim(),total:total()};
      tx.set(db.collection('orders').doc(num),order);
      return order
    });
    C.orders=[o,...C.orders.filter(x=>x.id!==o.id)];bump();
    S.cart=[];S.note='';S.receipt=o.id;S.page='receipt';S.sig=sig();
    toast('Order placed! The canteen can see it now.');render()
  }catch(x){
    if(String(x.message).startsWith('low:')){toast(`${x.message.slice(4)} just ran low. Your cart was updated.`,1);render()}
    else toast('Could not place the order. Check your internet and try again.',1)
  }finally{S.busy=0}
}

function reorder(id){
  const o=myOrders().find(x=>x.id===id);if(!o)return;const f=foods();let n=0;
  o.items.forEach(i=>{const x=f.find(y=>y.name===i.name);if(x&&x.stock>0){S.cart.push({id:x.id,qty:Math.min(i.qty,x.stock)});n++}});
  toast(n?`${n} item${n>1?'s':''} added to your cart`:'Those items are unavailable right now',!n);if(n){S.page='cart'}render()
}
