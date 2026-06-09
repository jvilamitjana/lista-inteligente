import { useState, useEffect, useRef } from "react";

// ─── DATOS BASE ────────────────────────────────────────────────────────────────
const RECETAS_BASE = [
  {
    id: 1, nombre: "Pasta Boloñesa", tiempo: 35, categoria: "Pasta",
    emoji: "🍝", porciones_base: 4,
    ingredientes: [
      { nombre: "Pasta", cantidad: 400, unidad: "g" },
      { nombre: "Carne picada", cantidad: 500, unidad: "g" },
      { nombre: "Tomate triturado", cantidad: 400, unidad: "g" },
      { nombre: "Cebolla", cantidad: 1, unidad: "ud" },
      { nombre: "Ajo", cantidad: 3, unidad: "dientes" },
      { nombre: "Aceite de oliva", cantidad: 3, unidad: "cdas" },
    ]
  },
  {
    id: 2, nombre: "Pollo al Horno", tiempo: 60, categoria: "Carnes",
    emoji: "🍗", porciones_base: 4,
    ingredientes: [
      { nombre: "Pollo entero", cantidad: 1.5, unidad: "kg" },
      { nombre: "Patatas", cantidad: 600, unidad: "g" },
      { nombre: "Ajo", cantidad: 4, unidad: "dientes" },
      { nombre: "Limón", cantidad: 1, unidad: "ud" },
      { nombre: "Romero", cantidad: 1, unidad: "rama" },
      { nombre: "Aceite de oliva", cantidad: 4, unidad: "cdas" },
    ]
  },
  {
    id: 3, nombre: "Ensalada César", tiempo: 15, categoria: "Ensaladas",
    emoji: "🥗", porciones_base: 2,
    ingredientes: [
      { nombre: "Lechuga romana", cantidad: 1, unidad: "ud" },
      { nombre: "Pechuga de pollo", cantidad: 300, unidad: "g" },
      { nombre: "Parmesano", cantidad: 50, unidad: "g" },
      { nombre: "Pan de molde", cantidad: 2, unidad: "rebanadas" },
      { nombre: "Salsa César", cantidad: 80, unidad: "ml" },
    ]
  },
  {
    id: 4, nombre: "Tortilla Española", tiempo: 25, categoria: "Huevos",
    emoji: "🍳", porciones_base: 4,
    ingredientes: [
      { nombre: "Huevos", cantidad: 6, unidad: "ud" },
      { nombre: "Patatas", cantidad: 500, unidad: "g" },
      { nombre: "Cebolla", cantidad: 1, unidad: "ud" },
      { nombre: "Aceite de oliva", cantidad: 200, unidad: "ml" },
      { nombre: "Sal", cantidad: 1, unidad: "pizca" },
    ]
  },
  {
    id: 5, nombre: "Lentejas Estofadas", tiempo: 50, categoria: "Legumbres",
    emoji: "🍲", porciones_base: 4,
    ingredientes: [
      { nombre: "Lentejas", cantidad: 400, unidad: "g" },
      { nombre: "Chorizo", cantidad: 150, unidad: "g" },
      { nombre: "Zanahoria", cantidad: 2, unidad: "ud" },
      { nombre: "Cebolla", cantidad: 1, unidad: "ud" },
      { nombre: "Tomate", cantidad: 1, unidad: "ud" },
      { nombre: "Pimentón", cantidad: 1, unidad: "cdta" },
    ]
  },
  {
    id: 6, nombre: "Salmón a la Plancha", tiempo: 20, categoria: "Pescado",
    emoji: "🐟", porciones_base: 2,
    ingredientes: [
      { nombre: "Salmón", cantidad: 400, unidad: "g" },
      { nombre: "Limón", cantidad: 1, unidad: "ud" },
      { nombre: "Eneldo", cantidad: 1, unidad: "cdta" },
      { nombre: "Aceite de oliva", cantidad: 2, unidad: "cdas" },
      { nombre: "Sal y pimienta", cantidad: 1, unidad: "pizca" },
    ]
  },
  {
    id: 7, nombre: "Gazpacho Andaluz", tiempo: 15, categoria: "Sopas",
    emoji: "🥣", porciones_base: 4,
    ingredientes: [
      { nombre: "Tomates maduros", cantidad: 800, unidad: "g" },
      { nombre: "Pepino", cantidad: 1, unidad: "ud" },
      { nombre: "Pimiento verde", cantidad: 1, unidad: "ud" },
      { nombre: "Ajo", cantidad: 1, unidad: "diente" },
      { nombre: "Aceite de oliva", cantidad: 4, unidad: "cdas" },
      { nombre: "Vinagre", cantidad: 2, unidad: "cdas" },
      { nombre: "Pan del día anterior", cantidad: 50, unidad: "g" },
    ]
  },
  {
    id: 8, nombre: "Risotto de Setas", tiempo: 40, categoria: "Arroz",
    emoji: "🍄", porciones_base: 3,
    ingredientes: [
      { nombre: "Arroz arborio", cantidad: 300, unidad: "g" },
      { nombre: "Setas variadas", cantidad: 250, unidad: "g" },
      { nombre: "Caldo de verduras", cantidad: 900, unidad: "ml" },
      { nombre: "Vino blanco", cantidad: 100, unidad: "ml" },
      { nombre: "Parmesano", cantidad: 60, unidad: "g" },
      { nombre: "Cebolla", cantidad: 1, unidad: "ud" },
    ]
  },
];

const CATEGORIAS_COLORES = {
  "Pasta": "#7CB518", "Carnes": "#C9643A", "Ensaladas": "#4A9B6F",
  "Huevos": "#E8B84B", "Legumbres": "#8B6B47", "Pescado": "#4A90D9",
  "Sopas": "#D45E8A", "Arroz": "#9B7CB5", "Mis Recetas": "#C9643A",
};

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function escalarIngredientes(ingredientes, porcionesBase, porcionesTarget) {
  const ratio = porcionesTarget / porcionesBase;
  return ingredientes.map(ing => ({
    ...ing,
    cantidad: +(ing.cantidad * ratio).toFixed(2)
  }));
}

function consolidarLista(plan) {
  const mapa = {};
  plan.forEach(({ receta, comensales }) => {
    const ratio = comensales / receta.porciones_base;
    receta.ingredientes.forEach(ing => {
      const key = ing.nombre.toLowerCase();
      if (!mapa[key]) mapa[key] = { nombre: ing.nombre, cantidad: 0, unidad: ing.unidad };
      mapa[key].cantidad += +(ing.cantidad * ratio).toFixed(2);
    });
  });
  return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ─── COMPONENTES PEQUEÑOS ──────────────────────────────────────────────────────
function Badge({ text, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}55`,
      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
      letterSpacing: 0.5, textTransform: "uppercase"
    }}>{text}</span>
  );
}

function CartIcon({ count }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <span style={{ fontSize: 26 }}>🛒</span>
      {count > 0 && (
        <span style={{
          position: "absolute", top: -6, right: -8,
          background: "#C9643A", color: "#fff",
          borderRadius: "50%", width: 18, height: 18,
          fontSize: 11, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px #C9643A88"
        }}>{count}</span>
      )}
    </div>
  );
}

function NumericStepper({ value, onChange, min = 1, max = 20 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 28, height: 28, borderRadius: "50%", border: "none",
          background: "#2E4A2E", color: "#7CB518", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800
        }}>−</button>
      <span style={{ minWidth: 24, textAlign: "center", fontWeight: 800, color: "#F5F0E8", fontSize: 15 }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 28, height: 28, borderRadius: "50%", border: "none",
          background: "#2E4A2E", color: "#7CB518", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800
        }}>+</button>
    </div>
  );
}

// ─── MODAL DETALLE RECETA ──────────────────────────────────────────────────────
function ModalReceta({ receta, onClose, onAgregar }) {
  const [comensales, setComensales] = useState(receta.porciones_base);
  const ingredientes = escalarIngredientes(receta.ingredientes, receta.porciones_base, comensales);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0008", zIndex: 200,
      display: "flex", alignItems: "flex-end", justifyContent: "center"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1A2E1A", borderRadius: "24px 24px 0 0",
        padding: "28px 20px 36px", width: "100%", maxWidth: 480,
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 -8px 40px #0009"
      }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 52 }}>{receta.emoji}</div>
          <h2 style={{ color: "#F5F0E8", margin: "8px 0 4px", fontSize: 22, fontWeight: 900 }}>{receta.nombre}</h2>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 }}>
            <Badge text={receta.categoria} color={CATEGORIAS_COLORES[receta.categoria] || "#7CB518"} />
            <Badge text={`⏱ ${receta.tiempo} min`} color="#7CB518" />
          </div>
        </div>

        <div style={{
          background: "#243824", borderRadius: 16, padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20
        }}>
          <div>
            <div style={{ color: "#7CB51888", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>COMENSALES</div>
            <div style={{ color: "#F5F0E8", fontSize: 13 }}>Base: {receta.porciones_base} personas</div>
          </div>
          <NumericStepper value={comensales} onChange={setComensales} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#7CB518", fontSize: 12, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
            INGREDIENTES PARA {comensales} {comensales === 1 ? "PERSONA" : "PERSONAS"}
          </div>
          {ingredientes.map((ing, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0", borderBottom: "1px solid #2E4A2E22"
            }}>
              <span style={{ color: "#D8D0C0", fontSize: 14 }}>{ing.nombre}</span>
              <span style={{
                color: "#7CB518", fontWeight: 800, fontSize: 14,
                background: "#7CB51818", padding: "2px 10px", borderRadius: 20
              }}>{ing.cantidad} {ing.unidad}</span>
            </div>
          ))}
        </div>

        <button onClick={() => { onAgregar(receta, comensales); onClose(); }} style={{
          width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #7CB518, #5A8A10)",
          color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 20px #7CB51855", letterSpacing: 0.5
        }}>
          + Añadir al Plan Semanal
        </button>
      </div>
    </div>
  );
}

// ─── MODAL CREAR RECETA ────────────────────────────────────────────────────────
function ModalCrearReceta({ onClose, onGuardar, editando }) {
  const [nombre, setNombre] = useState(editando?.nombre || "");
  const [emoji, setEmoji] = useState(editando?.emoji || "🍽️");
  const [tiempo, setTiempo] = useState(editando?.tiempo || 30);
  const [porciones, setPorciones] = useState(editando?.porciones_base || 4);
  const [categoria, setCategoria] = useState(editando?.categoria || "Mis Recetas");
  const [ingredientes, setIngredientes] = useState(
    editando?.ingredientes || [{ nombre: "", cantidad: "", unidad: "g" }]
  );

  const EMOJIS = ["🍽️","🥘","🍲","🥗","🍝","🍛","🍜","🥙","🌮","🍕","🥞","🍳","🥚","🫕","🍱"];
  const UNIDADES = ["g", "kg", "ml", "l", "ud", "dientes", "rebanadas", "cdas", "cdta", "taza", "rama", "pizca", "lata"];

  const addIngrediente = () => setIngredientes([...ingredientes, { nombre: "", cantidad: "", unidad: "g" }]);
  const removeIngrediente = (i) => setIngredientes(ingredientes.filter((_, idx) => idx !== i));
  const updateIngrediente = (i, field, value) => {
    const updated = [...ingredientes];
    updated[i] = { ...updated[i], [field]: value };
    setIngredientes(updated);
  };

  const guardar = () => {
    if (!nombre.trim() || ingredientes.some(i => !i.nombre.trim() || !i.cantidad)) return;
    onGuardar({
      id: editando?.id || Date.now(),
      nombre: nombre.trim(), emoji, tiempo: +tiempo,
      porciones_base: +porciones, categoria,
      ingredientes: ingredientes.map(i => ({ ...i, cantidad: +i.cantidad })),
      esPersonal: true
    });
    onClose();
  };

  const inputStyle = {
    background: "#243824", border: "1px solid #3A5A3A", borderRadius: 10,
    color: "#F5F0E8", padding: "10px 14px", fontSize: 14, width: "100%",
    boxSizing: "border-box", outline: "none"
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000a", zIndex: 300,
      display: "flex", alignItems: "flex-end", justifyContent: "center"
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#1A2E1A", borderRadius: "24px 24px 0 0",
        padding: "28px 20px 36px", width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto"
      }}>
        <h2 style={{ color: "#F5F0E8", marginTop: 0, marginBottom: 20, fontSize: 20, fontWeight: 900 }}>
          {editando ? "✏️ Editar Receta" : "✨ Nueva Receta"}
        </h2>

        {/* Emoji selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, marginBottom: 8, letterSpacing: 1 }}>ICONO</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                width: 40, height: 40, borderRadius: 10, border: `2px solid ${emoji === e ? "#7CB518" : "#3A5A3A"}`,
                background: emoji === e ? "#7CB51822" : "#243824", fontSize: 20, cursor: "pointer"
              }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>NOMBRE</div>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Paella Valenciana" style={inputStyle} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>TIEMPO</div>
            <input type="number" value={tiempo} onChange={e => setTiempo(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>PORCIONES</div>
            <input type="number" value={porciones} onChange={e => setPorciones(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>CATEGORÍA</div>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
              {["Mis Recetas", "Pasta", "Carnes", "Pescado", "Ensaladas", "Huevos", "Legumbres", "Sopas", "Arroz"].map(c =>
                <option key={c} value={c}>{c}</option>
              )}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, marginBottom: 10, letterSpacing: 1 }}>INGREDIENTES</div>
          {ingredientes.map((ing, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 28px", gap: 6, marginBottom: 8, alignItems: "center" }}>
              <input value={ing.nombre} onChange={e => updateIngrediente(i, "nombre", e.target.value)}
                placeholder="Ingrediente" style={{ ...inputStyle, fontSize: 13 }} />
              <input type="number" value={ing.cantidad} onChange={e => updateIngrediente(i, "cantidad", e.target.value)}
                placeholder="Cant." style={{ ...inputStyle, fontSize: 13 }} />
              <select value={ing.unidad} onChange={e => updateIngrediente(i, "unidad", e.target.value)}
                style={{ ...inputStyle, fontSize: 12, padding: "10px 6px" }}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={() => removeIngrediente(i)} style={{
                background: "#C9643A22", border: "none", borderRadius: 8, color: "#C9643A",
                fontSize: 16, cursor: "pointer", height: 38, display: "flex", alignItems: "center", justifyContent: "center"
              }}>×</button>
            </div>
          ))}
          <button onClick={addIngrediente} style={{
            width: "100%", padding: "10px 0", border: "1px dashed #3A5A3A", borderRadius: 10,
            background: "transparent", color: "#7CB518", fontSize: 13, cursor: "pointer", fontWeight: 700, marginTop: 4
          }}>+ Añadir ingrediente</button>
        </div>

        <button onClick={guardar} style={{
          width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #7CB518, #5A8A10)",
          color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer",
          boxShadow: "0 4px 20px #7CB51855"
        }}>
          {editando ? "Guardar Cambios" : "Crear Receta"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB RECETAS ──────────────────────────────────────────────────────────────
function TabRecetas({ onVerDetalle }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroPorciones, setFiltroPorciones] = useState(0);

  const categorias = ["Todas", ...new Set(RECETAS_BASE.map(r => r.categoria))];
  const filtradas = RECETAS_BASE.filter(r => {
    const matchBusq = r.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchCat = filtroCategoria === "Todas" || r.categoria === filtroCategoria;
    return matchBusq && matchCat;
  });

  return (
    <div style={{ padding: "0 16px" }}>
      <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="🔍  Buscar recetas..."
        style={{
          width: "100%", boxSizing: "border-box", padding: "12px 16px",
          background: "#243824", border: "1px solid #3A5A3A", borderRadius: 14,
          color: "#F5F0E8", fontSize: 14, marginBottom: 14, outline: "none"
        }} />

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 16 }}>
        {categorias.map(cat => (
          <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{
            padding: "6px 14px", borderRadius: 20, border: "none", whiteSpace: "nowrap",
            background: filtroCategoria === cat ? "#7CB518" : "#243824",
            color: filtroCategoria === cat ? "#fff" : "#A0B890",
            fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
          }}>{cat}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtradas.map(receta => (
          <div key={receta.id} onClick={() => onVerDetalle(receta)}
            style={{
              background: "#243824", borderRadius: 16, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
              border: "1px solid #3A5A3A22",
              transition: "transform 0.15s, background 0.15s",
              active: { transform: "scale(0.98)" }
            }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: (CATEGORIAS_COLORES[receta.categoria] || "#7CB518") + "22",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0
            }}>{receta.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#F5F0E8", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{receta.nombre}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Badge text={receta.categoria} color={CATEGORIAS_COLORES[receta.categoria] || "#7CB518"} />
                <span style={{ color: "#7CB518", fontSize: 12 }}>⏱ {receta.tiempo}min</span>
                <span style={{ color: "#A0B890", fontSize: 12 }}>👥 {receta.porciones_base}p</span>
              </div>
            </div>
            <span style={{ color: "#3A5A3A", fontSize: 20 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB MIS RECETAS ──────────────────────────────────────────────────────────
function TabMisRecetas({ misRecetas, onVerDetalle, onEditar, onEliminar, onCrear }) {
  return (
    <div style={{ padding: "0 16px" }}>
      <button onClick={onCrear} style={{
        width: "100%", padding: "14px 0", borderRadius: 16, border: "2px dashed #7CB518",
        background: "#7CB51812", color: "#7CB518", fontSize: 15, fontWeight: 800,
        cursor: "pointer", marginBottom: 20, letterSpacing: 0.5
      }}>+ Crear nueva receta</button>

      {misRecetas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍🍳</div>
          <div style={{ color: "#7CB518", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Sin recetas personales aún</div>
          <div style={{ color: "#6A8A6A", fontSize: 14 }}>Crea tus propias recetas con cantidades personalizadas</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {misRecetas.map(receta => (
            <div key={receta.id} style={{
              background: "#243824", borderRadius: 16, padding: "14px 16px",
              border: "1px solid #C9643A33"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "#C9643A22", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 26, flexShrink: 0
                }}>{receta.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#F5F0E8", fontWeight: 800, fontSize: 15 }}>{receta.nombre}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <span style={{ color: "#C9643A", fontSize: 12 }}>⏱ {receta.tiempo}min</span>
                    <span style={{ color: "#A0B890", fontSize: 12 }}>👥 {receta.porciones_base}p base</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onVerDetalle(receta)} style={{
                  flex: 2, padding: "9px 0", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg, #7CB518, #5A8A10)",
                  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer"
                }}>Ver & Añadir</button>
                <button onClick={() => onEditar(receta)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                  background: "#3A5A3A", color: "#A0C890", fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}>Editar</button>
                <button onClick={() => onEliminar(receta.id)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                  background: "#C9643A22", color: "#C9643A", fontSize: 13, fontWeight: 700, cursor: "pointer"
                }}>Borrar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB PLAN SEMANAL ─────────────────────────────────────────────────────────
function TabPlan({ plan, onRemover }) {
  const todasRecetas = [...RECETAS_BASE];

  return (
    <div style={{ padding: "0 16px" }}>
      {plan.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📅</div>
          <div style={{ color: "#7CB518", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Plan vacío</div>
          <div style={{ color: "#6A8A6A", fontSize: 14 }}>Añade recetas desde la pestaña Recetas para construir tu menú semanal</div>
        </div>
      ) : (
        <>
          <div style={{
            background: "#243824", borderRadius: 16, padding: "14px 16px",
            marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>RESUMEN</div>
              <div style={{ color: "#F5F0E8", fontWeight: 800, fontSize: 18 }}>{plan.length} {plan.length === 1 ? "receta" : "recetas"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>COMENSALES TOTAL</div>
              <div style={{ color: "#F5F0E8", fontWeight: 800, fontSize: 18 }}>
                {plan.reduce((s, p) => s + p.comensales, 0)} personas
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {plan.map((item, i) => (
              <div key={i} style={{
                background: "#243824", borderRadius: 16, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12,
                border: "1px solid #3A5A3A33"
              }}>
                <div style={{ fontSize: 30, flexShrink: 0 }}>{item.receta.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#F5F0E8", fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{item.receta.nombre}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ color: "#7CB518", fontSize: 12 }}>👥 {item.comensales} personas</span>
                    <span style={{ color: "#6A8A6A", fontSize: 12 }}>⏱ {item.receta.tiempo}min</span>
                  </div>
                </div>
                <button onClick={() => onRemover(i)} style={{
                  background: "#C9643A22", border: "none", borderRadius: 10,
                  color: "#C9643A", fontSize: 18, width: 34, height: 34, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── TAB LISTA DE COMPRA ──────────────────────────────────────────────────────
function TabLista({ plan }) {
  const [comprados, setComprados] = useState({});
  const lista = consolidarLista(plan);

  const toggleComprado = (nombre) => {
    setComprados(prev => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  const pendientes = lista.filter(i => !comprados[i.nombre]);
  const hechos = lista.filter(i => comprados[i.nombre]);
  const pct = lista.length > 0 ? Math.round((hechos.length / lista.length) * 100) : 0;

  if (plan.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 20px", paddingTop: "60px" }}>
      <div style={{ fontSize: 56, marginBottom: 12 }}>🛍️</div>
      <div style={{ color: "#7CB518", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Lista vacía</div>
      <div style={{ color: "#6A8A6A", fontSize: 14 }}>Añade recetas al plan semanal para generar automáticamente tu lista de la compra</div>
    </div>
  );

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Barra de progreso */}
      <div style={{ background: "#243824", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#F5F0E8", fontWeight: 800 }}>Progreso de compra</span>
          <span style={{ color: "#7CB518", fontWeight: 800 }}>{pct}%</span>
        </div>
        <div style={{ background: "#1A2E1A", borderRadius: 8, height: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 8, width: `${pct}%`,
            background: "linear-gradient(90deg, #7CB518, #9ADB20)",
            transition: "width 0.4s ease"
          }} />
        </div>
        <div style={{ color: "#6A8A6A", fontSize: 12, marginTop: 6 }}>
          {hechos.length} de {lista.length} artículos
        </div>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#7CB518", fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
            PENDIENTE ({pendientes.length})
          </div>
          {pendientes.map((ing, i) => (
            <div key={i} onClick={() => toggleComprado(ing.nombre)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                background: "#243824", borderRadius: 12, marginBottom: 6, cursor: "pointer",
                border: "1px solid #3A5A3A22"
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, border: "2px solid #3A5A3A",
                flexShrink: 0
              }} />
              <span style={{ flex: 1, color: "#D8D0C0", fontSize: 14 }}>{ing.nombre}</span>
              <span style={{
                color: "#7CB518", fontWeight: 800, fontSize: 13,
                background: "#7CB51818", padding: "2px 10px", borderRadius: 20
              }}>{ing.cantidad} {ing.unidad}</span>
            </div>
          ))}
        </div>
      )}

      {/* Comprados */}
      {hechos.length > 0 && (
        <div>
          <div style={{ color: "#4A6A4A", fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>
            COMPRADO ({hechos.length})
          </div>
          {hechos.map((ing, i) => (
            <div key={i} onClick={() => toggleComprado(ing.nombre)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
                background: "#1E321E", borderRadius: 12, marginBottom: 6, cursor: "pointer", opacity: 0.65
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, background: "#7CB518",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: "#fff", fontWeight: 900
              }}>✓</div>
              <span style={{ flex: 1, color: "#8A9A8A", fontSize: 14, textDecoration: "line-through" }}>{ing.nombre}</span>
              <span style={{ color: "#4A6A4A", fontSize: 13 }}>{ing.cantidad} {ing.unidad}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SUGERENCIAS IA ───────────────────────────────────────────────────────────
function SugerenciasIA({ onVerDetalle }) {
  const [comensales, setComensales] = useState(4);
  const [loading, setLoading] = useState(false);
  const [sugerencias, setSugerencias] = useState([]);
  const [error, setError] = useState(null);
  const [mostrar, setMostrar] = useState(false);

  const buscarSugerencias = async () => {
    setLoading(true);
    setError(null);
    setSugerencias([]);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `Eres un chef experto. Devuelve SOLO un objeto JSON con exactamente este formato sin texto adicional ni backticks:
{"recetas":[{"nombre":"string","emoji":"string","tiempo":number,"categoria":"string","ingredientes":[{"nombre":"string","cantidad":number,"unidad":"string"}]}]}
Genera 3 recetas para ${comensales} personas. Las cantidades deben ser exactas para ${comensales} personas.`,
          messages: [{ role: "user", content: `Sugiere 3 recetas variadas y saludables para ${comensales} persona${comensales !== 1 ? "s" : ""}. Incluye una de cada tipo: proteína, vegetariana, y libre elección.` }]
        })
      });
      const data = await response.json();
      const text = data.content.map(i => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setSugerencias(parsed.recetas.map((r, i) => ({
        ...r, id: 9000 + i, porciones_base: comensales, esIA: true
      })));
    } catch (e) {
      setError("No se pudieron cargar sugerencias. Intenta de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div style={{ margin: "0 16px 16px", background: "#1E3A2E", borderRadius: 16, overflow: "hidden", border: "1px solid #7CB51833" }}>
      <button onClick={() => setMostrar(!mostrar)} style={{
        width: "100%", padding: "14px 18px", background: "transparent", border: "none",
        display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <span style={{ color: "#7CB518", fontWeight: 800, fontSize: 14 }}>Sugerencias con IA</span>
        </div>
        <span style={{ color: "#7CB518", fontSize: 18, transform: mostrar ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</span>
      </button>

      {mostrar && (
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ color: "#A0B890", fontSize: 13 }}>Para</span>
            <NumericStepper value={comensales} onChange={setComensales} />
            <span style={{ color: "#A0B890", fontSize: 13 }}>personas</span>
          </div>
          <button onClick={buscarSugerencias} disabled={loading} style={{
            width: "100%", padding: "11px 0", borderRadius: 12, border: "none",
            background: loading ? "#3A5A3A" : "linear-gradient(135deg, #7CB518, #5A8A10)",
            color: "#fff", fontSize: 14, fontWeight: 800, cursor: loading ? "default" : "pointer",
            transition: "opacity 0.2s"
          }}>
            {loading ? "🔄 Generando..." : "🍴 Generar sugerencias"}
          </button>

          {error && <div style={{ color: "#C9643A", fontSize: 13, marginTop: 10, textAlign: "center" }}>{error}</div>}

          {sugerencias.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {sugerencias.map((r, i) => (
                <div key={i} onClick={() => onVerDetalle(r)} style={{
                  background: "#243824", borderRadius: 12, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12, cursor: "pointer"
                }}>
                  <span style={{ fontSize: 26 }}>{r.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#F5F0E8", fontWeight: 800, fontSize: 14 }}>{r.nombre}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                      <Badge text={r.categoria} color={CATEGORIAS_COLORES[r.categoria] || "#7CB518"} />
                      <span style={{ color: "#7CB518", fontSize: 12 }}>⏱ {r.tiempo}min</span>
                    </div>
                  </div>
                  <span style={{ color: "#3A5A3A", fontSize: 20 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("recetas");
  const [plan, setPlan] = useState([]);
  const [misRecetas, setMisRecetas] = useState([]);
  const [modalReceta, setModalReceta] = useState(null);
  const [modalCrear, setModalCrear] = useState(false);
  const [editandoReceta, setEditandoReceta] = useState(null);

  const agregarAlPlan = (receta, comensales) => {
    setPlan(prev => [...prev, { receta, comensales }]);
    setTab("plan");
  };

  const removerDelPlan = (i) => setPlan(prev => prev.filter((_, idx) => idx !== i));

  const guardarReceta = (receta) => {
    if (editandoReceta) {
      setMisRecetas(prev => prev.map(r => r.id === receta.id ? receta : r));
      setEditandoReceta(null);
    } else {
      setMisRecetas(prev => [...prev, receta]);
    }
  };

  const eliminarReceta = (id) => setMisRecetas(prev => prev.filter(r => r.id !== id));

  const TABS = [
    { id: "recetas", label: "Recetas", emoji: "🍳" },
    { id: "mis", label: "Mis", emoji: "👨‍🍳" },
    { id: "plan", label: "Plan", emoji: "📅" },
    { id: "lista", label: "Compra", emoji: "🛒" },
  ];

  return (
    <div style={{
      background: "#111E11", minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative", paddingBottom: 80
    }}>
      {/* HEADER */}
      <div style={{
        background: "linear-gradient(180deg, #0D1A0D 0%, #1A2E1A 100%)",
        padding: "20px 20px 16px",
        borderBottom: "1px solid #2A3A2A"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>🥬</span>
              <span style={{ color: "#7CB518", fontWeight: 900, fontSize: 20, letterSpacing: -0.5 }}>
                Lista<span style={{ color: "#F5F0E8" }}>Inteligente</span>
              </span>
            </div>
            <div style={{ color: "#5A7A5A", fontSize: 12, marginTop: 2 }}>Planifica, cocina, compra</div>
          </div>
          <div onClick={() => setTab("lista")} style={{ cursor: "pointer" }}>
            <CartIcon count={plan.length} />
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ paddingTop: 16 }}>
        {tab === "recetas" && (
          <>
            <SugerenciasIA onVerDetalle={setModalReceta} />
            <TabRecetas onVerDetalle={setModalReceta} />
          </>
        )}
        {tab === "mis" && (
          <TabMisRecetas
            misRecetas={misRecetas}
            onVerDetalle={setModalReceta}
            onEditar={(r) => { setEditandoReceta(r); setModalCrear(true); }}
            onEliminar={eliminarReceta}
            onCrear={() => { setEditandoReceta(null); setModalCrear(true); }}
          />
        )}
        {tab === "plan" && <TabPlan plan={plan} onRemover={removerDelPlan} />}
        {tab === "lista" && <TabLista plan={plan} />}
      </div>

      {/* NAV BOTTOM */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, background: "#0D1A0D",
        borderTop: "1px solid #2A3A2A",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        padding: "8px 0 16px",
        zIndex: 100
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 0"
          }}>
            <div style={{
              fontSize: 22, transition: "transform 0.2s",
              transform: tab === t.id ? "scale(1.2)" : "scale(1)",
              filter: tab === t.id ? "none" : "grayscale(0.4) opacity(0.6)"
            }}>{t.id === "lista" ? <CartIcon count={tab !== "lista" && plan.length > 0 ? plan.length : 0} /> : t.emoji}</div>
            <span style={{
              fontSize: 11, fontWeight: tab === t.id ? 800 : 500,
              color: tab === t.id ? "#7CB518" : "#4A6A4A"
            }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* MODALES */}
      {modalReceta && (
        <ModalReceta receta={modalReceta} onClose={() => setModalReceta(null)} onAgregar={agregarAlPlan} />
      )}
      {modalCrear && (
        <ModalCrearReceta
          onClose={() => { setModalCrear(false); setEditandoReceta(null); }}
          onGuardar={guardarReceta}
          editando={editandoReceta}
        />
      )}
    </div>
  );
}