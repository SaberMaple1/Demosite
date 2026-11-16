/* Student data comes from the server through Auth: the menu, my orders and the ordering rules. */
const foods=()=>Auth.data.foods;
const me=()=>Auth.current('student');
const updateMe=async(patch)=>{try{await Auth.updateProfile(patch);return true}catch(e){toast(e.message,1);return false}};
const myOrders=()=>Auth.data.orders;

const S={view:'login',page:'menu',cat:'All',q:'',cart:[],note:'',tab:'info',receipt:null,seen:{},idleAt:Date.now(),ost:'',busy:false,when:'today'};

/*  Cart (stock is only taken when the order is placed)  */
const PRE_MAX=20;
/* Today: capped by stock, hidden if "not available today". Tomorrow (pre-order): no stock cap, only foods that allow pre-orders. */
function cartLines(){const f=foods(),pre=S.when==='tomorrow';return S.cart.map(c=>{const x=f.find(i=>i.id===c.id);if(!x)return null;if(pre)return x.preorder?{...x,qty:Math.min(c.qty,PRE_MAX)}:null;return x.soldOut?null:{...x,qty:Math.min(c.qty,x.stock)}}).filter(l=>l&&l.qty>0)}
const orderOpen=()=>{const st=Auth.orderStatus();return S.when==='tomorrow'?st.pre:st.open};
const blockMsg=()=>{const st=Auth.orderStatus();return S.when==='tomorrow'?st.preMsg:st.msg};
function canOrder(f){const st=Auth.orderStatus();return S.when==='tomorrow'?(st.pre&&f.preorder):(st.open&&f.stock>0&&!f.soldOut)}
const total=()=>cartLines().reduce((s,l)=>s+l.qty*l.price,0);
const cartN=()=>cartLines().reduce((s,l)=>s+l.qty,0);
function addCart(id,d){const f=foods().find(x=>x.id===id);if(!f)return;const pre=S.when==='tomorrow';
  if(d>0){if(!orderOpen())return toast(blockMsg(),1);if(!canOrder(f))return toast(pre?`${f.name} can’t be pre-ordered.`:`${f.name} is not available today.`,1)}
  let c=S.cart.find(x=>x.id===id);if(!c){c={id,qty:0};S.cart.push(c)}
  if(d>0&&c.qty>=(pre?PRE_MAX:f.stock))return toast(pre?`Pre-order limit is ${PRE_MAX} per item.`:`Only ${f.stock} left of ${f.name}`,1);
  c.qty+=d;if(c.qty<=0)S.cart=S.cart.filter(x=>x!==c);if(d>0)toast('Added to cart');render()}

/* The server re-checks everything (open/closed, cut-off, stock, prices) when the order is placed. */
async function placeOrder(){
  const m=me();const lines=cartLines();if(!m||!lines.length||S.busy)return;
  if(!orderOpen()){toast(blockMsg(),1);return render()}
  S.busy=true;render();
  try{
    const o=await Auth.call('order_place',{p_items:lines.map(l=>({id:l.id,qty:l.qty})),p_note:S.note.trim(),p_when:S.when});
    await Auth.sync(true);
    S.cart=[];S.note='';S.receipt=o.id;S.page='receipt';S.seen[o.id]=o.status;toast('Order placed! The canteen can see it now.');
  }catch(e){
    toast(e.message,1);try{await Auth.sync(true)}catch{}
  }
  S.busy=false;render();
}

function reorder(id){const st=Auth.orderStatus();if(!st.open)return toast(st.msg,1);S.when='today';
  const o=myOrders().find(x=>x.id===id);if(!o)return;const f=foods();let n=0;
  o.items.forEach(i=>{const x=f.find(y=>y.name===i.name);if(x&&x.stock>0&&!x.soldOut){S.cart.push({id:x.id,qty:Math.min(i.qty,x.stock)});n++}});
  toast(n?`${n} item${n>1?'s':''} added to your cart`:'Those items are unavailable right now',!n);if(n){S.page='cart'}render()
}
