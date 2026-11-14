/* Student data comes from the server through Auth: the menu, my orders and the ordering rules. */
const foods=()=>Auth.data.foods;
const me=()=>Auth.current('student');
const updateMe=async(patch)=>{try{await Auth.updateProfile(patch);return true}catch(e){toast(e.message,1);return false}};
const myOrders=()=>Auth.data.orders;

const S={view:'login',page:'menu',cat:'All',q:'',cart:[],note:'',tab:'info',receipt:null,seen:{},idleAt:Date.now(),ost:'',busy:false};

/*  Cart (stock is only taken when the order is placed)  */
function cartLines(){const f=foods();return S.cart.map(c=>{const x=f.find(i=>i.id===c.id);return x?{...x,qty:Math.min(c.qty,x.stock)}:null}).filter(l=>l&&l.qty>0)}
const total=()=>cartLines().reduce((s,l)=>s+l.qty*l.price,0);
const cartN=()=>cartLines().reduce((s,l)=>s+l.qty,0);
function addCart(id,d){const f=foods().find(x=>x.id===id);if(!f)return;if(d>0){const st=Auth.orderStatus();if(!st.open)return toast(st.msg,1)}let c=S.cart.find(x=>x.id===id);if(!c){c={id,qty:0};S.cart.push(c)}
  if(d>0&&c.qty>=f.stock)return toast(`Only ${f.stock} left of ${f.name}`,1);c.qty+=d;if(c.qty<=0)S.cart=S.cart.filter(x=>x!==c);if(d>0)toast('Added to cart');render()}

/* The server re-checks everything (open/closed, cut-off, stock, prices) when the order is placed. */
async function placeOrder(){
  const m=me();const lines=cartLines();if(!m||!lines.length||S.busy)return;
  const st=Auth.orderStatus();if(!st.open){toast(st.msg,1);return render()}
  S.busy=true;render();
  try{
    const o=await Auth.call('order_place',{p_items:lines.map(l=>({id:l.id,qty:l.qty})),p_note:S.note.trim()});
    await Auth.sync(true);
    S.cart=[];S.note='';S.receipt=o.id;S.page='receipt';S.seen[o.id]=o.status;toast('Order placed! The canteen can see it now.');
  }catch(e){
    toast(e.message,1);try{await Auth.sync(true)}catch{}
  }
  S.busy=false;render();
}

function reorder(id){const st=Auth.orderStatus();if(!st.open)return toast(st.msg,1);
  const o=myOrders().find(x=>x.id===id);if(!o)return;const f=foods();let n=0;
  o.items.forEach(i=>{const x=f.find(y=>y.name===i.name);if(x&&x.stock>0){S.cart.push({id:x.id,qty:Math.min(i.qty,x.stock)});n++}});
  toast(n?`${n} item${n>1?'s':''} added to your cart`:'Those items are unavailable right now',!n);if(n){S.page='cart'}render()
}
