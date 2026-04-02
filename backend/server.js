const express = require("express")
const path = require("path")
const mongoose = require("mongoose")
const multer = require("multer")


const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// SERVIR IMAGENES
app.use("/uploads", express.static(path.join(__dirname,"uploads")))

// CONEXION
mongoose.connect("mongodb+srv://usuario:password@cluster.mongodb.net/sensify", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


// MULTER
const storage = multer.diskStorage({
destination:(req,file,cb)=>{
cb(null, path.join(__dirname,"uploads"))
},
filename:(req,file,cb)=>{
cb(null, Date.now()+"-"+file.originalname)
}
})

const upload = multer({
storage:storage,
limits:{fileSize:5*1024*1024},
fileFilter:(req,file,cb)=>{
const tipos = [
"image/jpeg",
"image/png",
"image/webp",
"image/svg+xml"
]

if(tipos.includes(file.mimetype)){
cb(null,true)
}else{
cb(new Error("Tipo de archivo no permitido"), false)
}
}
})


// MODELOS
// SOLO TE MARCO LO NUEVO (lo demás déjalo igual)

// MODELO (IMPORTANTE)
const Producto = mongoose.model("Producto",{
nombre:String,
precio:Number,
descripcion:String,
imagenes:[String],
stock:Number,
categoria:String,
vistas:{type:Number, default:0},
promo:Boolean,
descuento:{ type:Number, default:0 },
precioPromo:Number
})


// NUEVA RUTA 👇
app.post("/productos/vista/:id", async (req,res)=>{

let producto = await Producto.findById(req.params.id)

if(!producto) return res.send("no existe")

producto.vistas += 1
await producto.save()

res.send("ok")

})

const Pedido = mongoose.model("Pedido",{
numero:String,
usuario:String,
productos:Array,
total:Number,
fecha: Date,
estado:{ type:String, default:"pendiente" }
})

app.post("/pedido", async (req,res)=>{
let pedido = new Pedido({
...req.body,
fecha: new Date()
})
await pedido.save()
res.json({mensaje:"pedido guardado"})
})

app.put("/pedido/:id", async (req,res)=>{
try{

let pedido = await Pedido.findById(req.params.id)
if(!pedido) return res.status(404).send("no existe")

// SOLO si no estaba enviado antes
if(pedido.estado !== "enviado"){

pedido.estado = "enviado"

// 🔥 ACTUALIZAR STOCK
if(pedido.productos){

for(let prod of pedido.productos){

let productoDB = await Producto.findOne({nombre: prod.nombre})

if(productoDB){
productoDB.stock -= prod.cantidad
await productoDB.save()
}}
}}

await pedido.save()

res.json({mensaje:"actualizado"})

}catch(e){
console.log(e)
res.status(500).send("error")
}
})

const Usuario = mongoose.model("Usuario",{
nombre:String,
apellido:String,
correo:String,
password:String,
rol:String
})

const Carrito = mongoose.model("Carrito",{
usuario:String,
productos:[
{
productoId:String,
nombre:String,
precio:Number,
cantidad:Number
}
]
})

const Banner = mongoose.model("Banner", {
imagenes: [String]
})

app.put("/productos/:id", async (req,res)=>{
await Producto.findByIdAndUpdate(req.params.id, req.body)
res.send("Producto actualizado")
})

app.post("/banner", upload.array("imagenes", 10), async (req,res)=>{
try{

if(!req.files || req.files.length === 0){
return res.status(400).send("No llegaron imágenes")
}

let imagenes = req.files.map(f => "/uploads/" + f.filename)

let existente = await Banner.findOne()

if(existente){
existente.imagenes = imagenes
await existente.save()
}else{
let nuevo = new Banner({imagenes})
await nuevo.save()
}

res.send("banner guardado")

}catch(e){
console.log("ERROR REAL:", e)
res.status(500).send("error")
}
})

app.get("/banner", async (req,res)=>{
let banner = await Banner.findOne()
res.json(banner || {imagenes:[]})
})

app.post("/carrito/agregar", async (req,res)=>{

let {usuario, producto} = req.body

let carrito = await Carrito.findOne({usuario})

if(!carrito){
carrito = new Carrito({
usuario,
productos:[]
})
}

let existe = carrito.productos.find(p=>p.productoId === producto.id)

if(existe){
existe.cantidad += producto.cantidad
}else{
carrito.productos.push(producto)
}

await carrito.save()

res.send("ok")
})


app.get("/carrito/:usuario", async (req,res)=>{
let carrito = await Carrito.findOne({usuario:req.params.usuario})
if(!carrito) return res.json({productos:[]})
res.json(carrito)
})

app.post("/carrito/eliminar", async (req,res)=>{

let carrito = await Carrito.findOne({usuario:req.body.usuario})

carrito.productos = carrito.productos.filter(p=>p.productoId !== req.body.productoId)

await carrito.save()

res.send("ok")
})


// REGISTRO
app.post("/registro", async (req,res)=>{
let existe = await Usuario.findOne({correo:req.body.correo})
if(existe) return res.send("correo ya registrado")

let nuevo = new Usuario({
nombre:req.body.nombre,
apellido:req.body.apellido,
correo:req.body.correo,
password:req.body.password,
rol:"cliente"
})

await nuevo.save()
res.send("usuario registrado")
})


// LOGIN 
app.post("/login", async (req,res)=>{

let usuario = await Usuario.findOne({
correo:req.body.correo,
password:req.body.password
})

if(!usuario){
return res.json({mensaje:"error"})
}

res.json({
mensaje:"login correcto",
rol:usuario.rol,
nombre:usuario.nombre
})

})


// CREAR PRODUCTO
app.post("/productos", upload.array("imagenes", 6), async (req,res)=>{
  console.log("FILES:", req.files)
console.log("BODY:", req.body)
try{

if(!req.files || req.files.length === 0){
return res.status(400).send("imagen requerida")
}

let imagenes = req.files.map(f => "/uploads/" + f.filename)


let nuevo = new Producto({
nombre:req.body.nombre,
precio:req.body.precio,
descripcion:req.body.descripcion,
imagenes:imagenes,
categoria: (req.body.categoria || "").trim().toLowerCase(),
stock:req.body.stock,

// 🔥 PROMO
promo: req.body.promo === "si",
descuento: Number(req.body.descuento) || 0,
precioPromo: Number(req.body.precioPromo) || 0
})
await nuevo.save()

res.send("producto creado")

}catch(e){
console.log(e)
res.status(500).send("error real del servidor")
}
})



// OBTENER PRODUCTOS
app.get("/productos", async (req,res)=>{
let productos = await Producto.find()
res.json(productos)
})


// COMPRAR
app.post("/comprar/:id", async (req,res)=>{

let producto = await Producto.findById(req.params.id)

if(!producto) return res.send("no existe")
if(producto.stock <= 0) return res.send("agotado")

producto.stock -= 1
await producto.save()

res.send("ok")

let pedido = new Pedido({
numero: Date.now().toString().slice(-4),
usuario: "invitado",
productos: [{
nombre: producto.nombre,
cantidad: 1,
precio: producto.precio
}],
total: producto.precio,
fecha:new Date(),
estado:"pendiente"
})
})


// PEDIDOS
app.get("/pedidos", async (req,res)=>{
let pedidos = await Pedido.find()
res.json(pedidos)
})


// CAMBIAR ESTADO

async function enviarPedido(id){

  let res = await fetch("http://localhost:3000/pedido/" + id,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ estado: "enviado" })
  })

  let data = await res.text()
  console.log("RESPUESTA:", data)

  if(res.ok){
    alert("Pedido enviado 🚚")
    mostrarPedidos()
  }else{
    alert("No se pudo actualizar")
  }
}

// BORRAR VENTAS
app.delete("/pedido/:id", async (req,res)=>{
try{

console.log("Eliminar pedido:", req.params.id)

await Pedido.findByIdAndDelete(req.params.id)

res.json({mensaje:"ok"})

}catch(e){
console.log("ERROR:", e)
res.status(500).json({error:"error eliminando"})
}
})

// INVENTARIO
app.get("/inventario", async (req,res)=>{

let productos = await Producto.find()
let pedidos = await Pedido.find()

let inventario = productos.map(p=>{

let vendidos = 0

pedidos.forEach(pedido => {

if(pedido.estado === "enviado" && pedido.productos){

pedido.productos.forEach(prod => {

if(prod.nombre === p.nombre){
vendidos += prod.cantidad
}

})

}

})

return {
nombre:p.nombre,
stock:p.stock,
vendidos:vendidos
}

})

res.json(inventario)
})


// ESTADISTICAS
app.get("/estadisticas", async (req,res)=>{

let productos = await Producto.find()
let pedidos = await Pedido.find()

let {desde, hasta} = req.query

if(desde && hasta){

let f1 = new Date(desde)
let f2 = new Date(hasta)

pedidos = pedidos.filter(p=>{
let fecha = new Date(p.fecha)
return fecha >= f1 && fecha <= f2
})

}

let usuarios = await Usuario.find()

let pendientes = pedidos.filter(p=>p.estado==="pendiente").length
let enviados = pedidos.filter(p=>p.estado==="enviado").length

let ventas={}
pedidos.forEach(p=>{
ventas[p.producto]=(ventas[p.producto]||0)+1
})

let masVendido="Ninguno"
let max=0

for(let p in ventas){
if(ventas[p]>max){
max=ventas[p]
masVendido=p
}
}


let valorInventario = productos.reduce((t,p)=>{
return t + (p.precio*p.stock)
},0)

let stockCritico = productos.filter(p => p.stock <= 3).length

res.json({
productos:productos.length,
usuarios:usuarios.length,
pendientes,
enviados,
masVendido,
stockCritico,
valorInventario
})

res.json({
productos: productos.length,
usuarios: usuarios.length,
pendientes,
enviados,
masVendido,
stockCritico,

listaProductos: productos.map(p=>p.nombre),
listaUsuarios: usuarios.map(u=>u.correo),
listaPendientes: pedidos.filter(p=>p.estado==="pendiente").map(p=>p.numero),
listaEnviados: pedidos.filter(p=>p.estado==="enviado").map(p=>p.numero)
})

})

app.get("/usuarios", async (req,res)=>{
let usuarios = await Usuario.find()
res.json(usuarios)
})

app.delete("/productos/:id", async (req,res)=>{

await Producto.findByIdAndDelete(req.params.id)

res.send("Producto eliminado")

})

app.post("/carrito/agregar", async (req,res)=>{

let {usuario, producto} = req.body

let carrito = await Carrito.findOne({usuario})

if(!carrito){
carrito = new Carrito({
usuario,
productos:[]
})
}

let existe = carrito.productos.find(p=>p.productoId === producto.id)

if(existe){
existe.cantidad += producto.cantidad
}else{
carrito.productos.push(producto)
}

await carrito.save()

res.send("ok")
})

// FRONTEND
app.use(express.static(path.join(__dirname,"../frontend")))

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor corriendo");
});