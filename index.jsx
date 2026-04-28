import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Google Font ────────────────────────────────────────────────────────────
const FontLoader = () => (
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');`}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2, 10);

const ts = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const cloneFlow = (flow) => ({
    nodes: flow.nodes.map((n) => ({ ...n })),
    edges: flow.edges.map((e) => ({ ...e })),
});

const INITIAL_NODES = [
    { id: "start", text: "How can we help you today?", type: "start", x: 420, y: 50, width: 320, height: 95 },
    { id: "billing", text: "What billing issue are you facing?\n1. Refund request\n2. Invoice question", type: "default", x: 70, y: 230, width: 300, height: 100 },
    { id: "tech", text: "What technical issue are you facing?\n1. Login problem\n2. Software bug\n3. Other", type: "default", x: 460, y: 230, width: 300, height: 110 },
    { id: "sales", text: "What can we help you with?\n1. Product info\n2. Live demo\n3. Pricing", type: "default", x: 850, y: 230, width: 300, height: 110 },
    { id: "refund_end", text: "✅ Your refund request has been received. We'll process it within 3 days.", type: "end", x: 70, y: 440, width: 280, height: 85 },
    { id: "invoice_end", text: "📄 Our team will check your invoice and reply within 24h.", type: "end", x: 460, y: 440, width: 300, height: 85 },
    { id: "login_help", text: "🔐 Login issue: reset your password or contact IT support.", type: "default", x: 850, y: 420, width: 300, height: 85 },
    { id: "bug_end", text: "🐞 Bug reported to engineering. We'll reach out soon.", type: "end", x: 850, y: 580, width: 280, height: 85 },
    { id: "product_end", text: "📦 Product catalog sent to your email. Check your inbox!", type: "end", x: 1140, y: 420, width: 300, height: 85 },
    { id: "demo_request", text: "🎥 Our team will schedule a demo within 1 hour.", type: "end", x: 1140, y: 560, width: 280, height: 85 },
];

const INITIAL_EDGES = [
    { id: "e1", from: "start", to: "billing", label: "1 Billing" },
    { id: "e2", from: "start", to: "tech", label: "2 Technical Support" },
    { id: "e3", from: "start", to: "sales", label: "3 Sales" },
    { id: "e4", from: "billing", to: "refund_end", label: "Request Refund" },
    { id: "e5", from: "billing", to: "invoice_end", label: "Invoice Question" },
    { id: "e6", from: "tech", to: "login_help", label: "1 Login" },
    { id: "e7", from: "tech", to: "bug_end", label: "2 Bug" },
    { id: "e8", from: "sales", to: "product_end", label: "1 Product Info" },
    { id: "e9", from: "sales", to: "demo_request", label: "2 Live Demo" },
];

const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: "⊞" },
    { key: "flow-builder", label: "Flow Builder", icon: "⋯" },
    { key: "analytics", label: "Analytics", icon: "▦" },
    { key: "templates", label: "Templates", icon: "▤" },
    { key: "settings", label: "Settings", icon: "⚙" },
];

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function createHistory(initial) {
    let past = [];
    let present = cloneFlow(initial);
    let future = [];
    return {
        getPresent: () => cloneFlow(present),
        push(newState) { past.push(cloneFlow(present)); present = cloneFlow(newState); future = []; },
        undo() {
            if (!past.length) return null;
            future.push(cloneFlow(present));
            present = past.pop();
            return cloneFlow(present);
        },
        redo() {
            if (!future.length) return null;
            past.push(cloneFlow(present));
            present = future.pop();
            return cloneFlow(present);
        },
        canUndo: () => past.length > 0,
        canRedo: () => future.length > 0,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/** Manages flow state + undo/redo history */
function useFlowState() {
    const [flowState, setFlowState] = useState(() => {
        try {
            const saved = localStorage.getItem("supportflow_editor");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.nodes) return cloneFlow(parsed);
            }
        } catch { /* ignore */ }
        return cloneFlow({ nodes: INITIAL_NODES, edges: INITIAL_EDGES });
    });

    const historyRef = useRef(
        createHistory({ nodes: INITIAL_NODES, edges: INITIAL_EDGES })
    );

    useEffect(() => {
        localStorage.setItem(
            "supportflow_editor",
            JSON.stringify({ nodes: flowState.nodes, edges: flowState.edges })
        );
    }, [flowState]);

    const updateFlow = useCallback((newFlow, recordHistory = true) => {
        if (recordHistory) historyRef.current.push(newFlow);
        setFlowState(cloneFlow(newFlow));
    }, []);

    const undo = useCallback(() => {
        if (historyRef.current.canUndo()) {
            const s = historyRef.current.undo();
            if (s) setFlowState(s);
        }
    }, []);

    const redo = useCallback(() => {
        if (historyRef.current.canRedo()) {
            const s = historyRef.current.redo();
            if (s) setFlowState(s);
        }
    }, []);

    const pushHistory = useCallback((flow) => historyRef.current.push(flow), []);

    return { flowState, updateFlow, undo, redo, pushHistory, historyRef };
}

/** Toast notification */
function useToast() {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    }, []);
    return { toast, showToast };
}

/** Chatbot widget logic */
function useChatbot(flowState) {
    const [isOpen, setIsOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [currentNodeId, setCurrentNodeId] = useState(null);

    const startFreshConversation = useCallback(() => {
        const startNode = flowState.nodes.find((n) => n.type === "start");
        if (startNode) {
            setChatHistory([{ id: uid(), role: "bot", text: startNode.text, nodeId: startNode.id, timestamp: ts() }]);
            setCurrentNodeId(startNode.id);
        } else {
            setChatHistory([{ id: uid(), role: "bot", text: "⚠️ No start node found. Please configure flow in Builder.", nodeId: null, timestamp: ts() }]);
            setCurrentNodeId(null);
        }
    }, [flowState.nodes]);

    useEffect(() => {
        if (isOpen) startFreshConversation();
    }, [isOpen, flowState, startFreshConversation]);

    const getOptions = useCallback(
        (nodeId) => (nodeId ? flowState.edges.filter((e) => e.from === nodeId) : []),
        [flowState.edges]
    );

    const selectOption = useCallback(
        (option) => {
            const target = flowState.nodes.find((n) => n.id === option.to);
            if (!target) return;
            setChatHistory((prev) => [
                ...prev,
                { id: uid(), role: "user", text: option.label, timestamp: ts() },
                { id: uid(), role: "bot", text: target.text, nodeId: target.id, timestamp: ts() },
            ]);
            setCurrentNodeId(target.id);
        },
        [flowState.nodes]
    );

    const isLeaf = useCallback(
        (nodeId) => !nodeId || flowState.edges.filter((e) => e.from === nodeId).length === 0,
        [flowState.edges]
    );

    return { isOpen, setIsOpen, chatHistory, currentNodeId, selectOption, resetChat: startFreshConversation, getOptions, isLeaf };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const STAT_CARDS = [
    { value: "124", label: "Conversations (last 7d)", color: "#6366f1" },
    { value: "87%", label: "Resolution rate", color: "#10b981" },
    { value: "4.8", label: "Avg. CSAT", color: "#f59e0b" },
];

const DashboardPage = () => (
    <div className="p-8 overflow-y-auto h-full">
        <h2 style={styles.pageTitle}>Dashboard</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginTop: 24 }}>
            {STAT_CARDS.map((c) => (
                <div key={c.label} style={styles.card}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: c.color, fontFamily: "DM Mono, monospace" }}>{c.value}</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{c.label}</div>
                </div>
            ))}
        </div>
        <div style={{ ...styles.card, marginTop: 24 }}>
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Recent flow activity</h3>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>No recent edits — start building your tree in Flow Builder.</p>
        </div>
    </div>
);

const ANALYTICS_ROWS = [
    { label: "Billing path usage", pct: 34 },
    { label: "Technical support", pct: 42 },
    { label: "Sales inquiries", pct: 24 },
];

const AnalyticsPage = () => (
    <div className="p-8 overflow-y-auto h-full">
        <h2 style={styles.pageTitle}>Analytics</h2>
        <div style={{ ...styles.card, marginTop: 24 }}>
            {ANALYTICS_ROWS.map((r) => (
                <div key={r.label} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                        <span>{r.label}</span><span style={{ fontWeight: 600 }}>{r.pct}%</span>
                    </div>
                    <div style={{ background: "#e2e8f0", borderRadius: 8, height: 8 }}>
                        <div style={{ background: "#6366f1", width: `${r.pct}%`, height: "100%", borderRadius: 8, transition: "width 0.6s ease" }} />
                    </div>
                </div>
            ))}
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Real-time analytics based on conversation logs (demo data).</p>
        </div>
    </div>
);

const TEMPLATES = [
    { icon: "🛍️", title: "E-commerce FAQ", desc: "Returns, shipping, order status" },
    { icon: "💻", title: "IT Support Desk", desc: "Password reset, VPN, software install" },
    { icon: "🏦", title: "Banking & Finance", desc: "Fraud, disputes, account issues" },
];

const TemplatesPage = () => (
    <div className="p-8 overflow-y-auto h-full">
        <h2 style={styles.pageTitle}>Templates</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginTop: 24 }}>
            {TEMPLATES.map((t) => (
                <div key={t.title} style={{ ...styles.card, cursor: "pointer" }}>
                    <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{t.icon} {t.title}</h3>
                    <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>{t.desc}</p>
                    <button style={styles.linkBtn}>Use template →</button>
                </div>
            ))}
        </div>
    </div>
);

const SettingsPage = () => (
    <div style={{ padding: 32, overflowY: "auto", height: "100%", maxWidth: 600 }}>
        <h2 style={styles.pageTitle}>Settings</h2>
        <div style={{ ...styles.card, marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <label style={styles.formLabel}>
                Bot Name
                <input style={styles.input} defaultValue="SupportFlow Assistant" />
            </label>
            <label style={styles.formLabel}>
                Default response when no match
                <textarea style={{ ...styles.input, resize: "vertical" }} rows={3} defaultValue="I'm not sure how to help. Please rephrase or contact support." />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked /> Enable analytics tracking
            </label>
            <button style={styles.primaryBtn}>Save preferences</button>
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// FLOW BUILDER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const NODE_THEME = {
    start: { border: "#10b981", bg: "#f0fdf4", badge: "#10b981", icon: "▶", label: "START" },
    end: { border: "#f43f5e", bg: "#fff1f2", badge: "#f43f5e", icon: "■", label: "END" },
    default: { border: "#cbd5e1", bg: "#ffffff", badge: "#94a3b8", icon: "?", label: "QUESTION" },
};

/** Individual draggable node card */
const NodeCard = ({ node, isSelected, onMouseDown, onClick, onDelete }) => {
    const theme = NODE_THEME[node.type] ?? NODE_THEME.default;
    return (
        <div
            onMouseDown={onMouseDown}
            onClick={onClick}
            style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: node.width,
                minHeight: node.height,
                background: theme.bg,
                border: `2px solid ${isSelected ? "#6366f1" : theme.border}`,
                borderRadius: 14,
                padding: "10px 14px",
                boxShadow: isSelected
                    ? "0 0 0 4px rgba(99,102,241,0.2), 0 10px 24px -4px rgba(0,0,0,0.12)"
                    : "0 4px 12px rgba(0,0,0,0.07)",
                cursor: "grab",
                zIndex: isSelected ? 30 : 10,
                transition: "box-shadow 0.15s, border-color 0.15s",
                fontFamily: "DM Sans, sans-serif",
                userSelect: "none",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: theme.badge }}>
                    {theme.icon} {theme.label}
                </span>
                {node.type !== "start" && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, lineHeight: 1, padding: 2 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f43f5e")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}
                    >✕</button>
                )}
            </div>
            <p style={{ fontSize: 12.5, color: "#1e293b", whiteSpace: "pre-line", lineHeight: 1.5, fontWeight: 500 }}>
                {node.text.length > 80 ? `${node.text.slice(0, 80)}…` : node.text}
            </p>
        </div>
    );
};

/** SVG connector layer */
const EdgeLayer = ({ nodes, edges }) => {
    const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

    const paths = useMemo(() =>
        edges.flatMap((edge) => {
            const f = nodeMap[edge.from];
            const t = nodeMap[edge.to];
            if (!f || !t) return [];
            const fx = f.x + f.width / 2, fy = f.y + f.height;
            const tx = t.x + t.width / 2, ty = t.y;
            const d = `M${fx},${fy} C${fx},${fy + 40} ${tx},${ty - 40} ${tx},${ty}`;
            const mx = (fx + tx) / 2, my = (fy + ty) / 2;
            return [{ id: edge.id, d, mx, my, label: edge.label }];
        }),
        [edges, nodeMap]
    );

    return (
        <svg
            style={{ position: "absolute", width: "100%", height: "100%", pointerEvents: "none", minWidth: 1500, minHeight: 900 }}
        >
            <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
                </marker>
            </defs>
            {paths.map(({ id, d, mx, my, label }) => (
                <g key={id}>
                    <path d={d} stroke="#94a3b8" strokeWidth={2} fill="none" markerEnd="url(#arrow)" />
                    <foreignObject x={mx - 52} y={my - 14} width={104} height={28}>
                        <div
                            style={{
                                background: "rgba(255,255,255,0.92)",
                                border: "1px solid #e2e8f0",
                                borderRadius: 20,
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "2px 8px",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                                fontFamily: "DM Sans, sans-serif",
                            }}
                        >
                            {label}
                        </div>
                    </foreignObject>
                </g>
            ))}
        </svg>
    );
};

/** Right-side edit panel */
const EditPanel = ({ node, flowState, onClose, onSave, onAddEdge, onDeleteEdge }) => {
    const [editText, setEditText] = useState(node.text);
    const [nodeType, setNodeType] = useState(node.type);
    const [targetId, setTargetId] = useState("");
    const [newLabel, setNewLabel] = useState("");

    useEffect(() => { setEditText(node.text); setNodeType(node.type); }, [node]);

    const outgoing = useMemo(() => flowState.edges.filter((e) => e.from === node.id), [flowState.edges, node.id]);
    const targets = useMemo(() => flowState.nodes.filter((n) => n.id !== node.id), [flowState.nodes, node.id]);

    const handleAddEdge = () => {
        if (!targetId) return;
        const ok = onAddEdge(node.id, targetId, newLabel);
        if (ok) { setTargetId(""); setNewLabel(""); }
    };

    return (
        <div style={{
            position: "fixed", right: 0, top: 0, bottom: 0, width: 360,
            background: "#fff", borderLeft: "1px solid #e2e8f0",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", zIndex: 50,
            display: "flex", flexDirection: "column",
            animation: "slideIn 0.22s ease-out",
            fontFamily: "DM Sans, sans-serif",
        }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>✏️ Edit Node</span>
                <button onClick={onClose} style={styles.iconBtn}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <label style={styles.formLabel}>
                    Message text
                    <textarea style={{ ...styles.input, resize: "vertical" }} rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} />
                </label>
                <label style={styles.formLabel}>
                    Node type
                    <select style={styles.input} value={nodeType} onChange={(e) => setNodeType(e.target.value)} disabled={node.type === "start"}>
                        <option value="default">Question node</option>
                        <option value="end">End node</option>
                    </select>
                </label>

                <div>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Outgoing connections</p>
                    {outgoing.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8" }}>No connections yet.</p>}
                    {outgoing.map((edge) => {
                        const t = flowState.nodes.find((n) => n.id === edge.to);
                        return (
                            <div key={edge.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "6px 10px", marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: "#475569" }}>{edge.label} → {t?.text.slice(0, 28)}…</span>
                                <button onClick={() => onDeleteEdge(edge.id)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 13 }}>✕</button>
                            </div>
                        );
                    })}
                </div>

                <div>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Add transition</p>
                    <select style={{ ...styles.input, marginBottom: 8 }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                        <option value="">Select target node…</option>
                        {targets.map((n) => <option key={n.id} value={n.id}>{n.text.slice(0, 45)}</option>)}
                    </select>
                    <input placeholder="Option label" style={{ ...styles.input, marginBottom: 8 }} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                    <button onClick={handleAddEdge} style={{ ...styles.primaryBtn, background: "#eef2ff", color: "#4338ca" }}>+ Add connection</button>
                </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9" }}>
                <button onClick={() => { onSave(node.id, { text: editText, type: nodeType }); onClose(); }} style={styles.primaryBtn}>
                    Apply changes
                </button>
            </div>
        </div>
    );
};

/** Toolbar */
const FlowToolbar = ({ onAddNode, onUndo, onRedo }) => (
    <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
        background: "#fff", borderBottom: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
        <button onClick={onAddNode} style={{ ...styles.toolBtn, background: "#6366f1", color: "#fff", border: "none" }}>
            ➕ Add Node
        </button>
        <div style={{ width: 1, height: 20, background: "#e2e8f0", margin: "0 4px" }} />
        <button onClick={onUndo} style={styles.toolBtn}>↩ Undo</button>
        <button onClick={onRedo} style={styles.toolBtn}>↪ Redo</button>
    </div>
);

/** Full Flow Builder page */
const FlowBuilder = ({ flowState, updateFlow, undo, redo, pushHistory, showToast }) => {
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [dragState, setDragState] = useState(null); // { nodeId, offsetX, offsetY }
    const canvasRef = useRef(null);

    const selectedNode = useMemo(
        () => flowState.nodes.find((n) => n.id === selectedNodeId) ?? null,
        [flowState.nodes, selectedNodeId]
    );

    // ── Node mutations ────────────────────────────────────────────────────────
    const addNode = useCallback(() => {
        let maxX = 400, maxY = 400;
        flowState.nodes.forEach((n) => { if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y; });
        const node = { id: `node_${uid()}`, text: "New question node\nEdit me", type: "default", x: maxX + 50, y: maxY + 50, width: 280, height: 90 };
        updateFlow({ nodes: [...flowState.nodes, node], edges: flowState.edges }, true);
        setSelectedNodeId(node.id);
        showToast("✨ New node added");
    }, [flowState, updateFlow, showToast]);

    const deleteNode = useCallback((nodeId) => {
        if (flowState.nodes.find((n) => n.id === nodeId)?.type === "start") { showToast("🚫 Cannot delete start node"); return; }
        updateFlow({
            nodes: flowState.nodes.filter((n) => n.id !== nodeId),
            edges: flowState.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
        }, true);
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
        showToast("Node deleted");
    }, [flowState, updateFlow, selectedNodeId, showToast]);

    const updateNodeProperty = useCallback((nodeId, updates) => {
        updateFlow({ nodes: flowState.nodes.map((n) => n.id === nodeId ? { ...n, ...updates } : n), edges: flowState.edges }, true);
    }, [flowState, updateFlow]);

    const addEdge = useCallback((fromId, toId, label) => {
        if (fromId === toId) { showToast("Cannot connect a node to itself"); return false; }
        if (flowState.edges.find((e) => e.from === fromId && e.to === toId)) { showToast("Connection already exists"); return false; }
        updateFlow({ nodes: flowState.nodes, edges: [...flowState.edges, { id: `edge_${uid()}`, from: fromId, to: toId, label: label.trim() || "option" }] }, true);
        showToast("✅ Connection added");
        return true;
    }, [flowState, updateFlow, showToast]);

    const deleteEdge = useCallback((edgeId) => {
        updateFlow({ nodes: flowState.nodes, edges: flowState.edges.filter((e) => e.id !== edgeId) }, true);
        showToast("Connection removed");
    }, [flowState, updateFlow, showToast]);

    // ── Drag handling ─────────────────────────────────────────────────────────
    const handleMouseDown = useCallback((e, nodeId, nodeX, nodeY) => {
        e.stopPropagation();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDragState({ nodeId, offsetX: e.clientX - rect.left - nodeX, offsetY: e.clientY - rect.top - nodeY });
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!dragState) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.max(0, e.clientX - rect.left - dragState.offsetX);
        const y = Math.max(0, e.clientY - rect.top - dragState.offsetY);
        const newNodes = flowState.nodes.map((n) => n.id === dragState.nodeId ? { ...n, x, y } : n);
        updateFlow({ nodes: newNodes, edges: flowState.edges }, false);
    }, [dragState, flowState, updateFlow]);

    const handleMouseUp = useCallback(() => {
        if (dragState) { pushHistory(flowState); setDragState(null); }
    }, [dragState, flowState, pushHistory]);

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
    }, [handleMouseMove, handleMouseUp]);

    return (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden" }}>
            <FlowToolbar onAddNode={addNode} onUndo={undo} onRedo={redo} />
            <div
                ref={canvasRef}
                style={{
                    flex: 1, position: "relative", overflow: "auto",
                    backgroundImage: "linear-gradient(to right,#e2e8f0 1px,transparent 1px),linear-gradient(to bottom,#e2e8f0 1px,transparent 1px)",
                    backgroundSize: "28px 28px",
                }}
            >
                <EdgeLayer nodes={flowState.nodes} edges={flowState.edges} />
                {flowState.nodes.map((node) => (
                    <NodeCard
                        key={node.id}
                        node={node}
                        isSelected={selectedNodeId === node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        onMouseDown={(e) => handleMouseDown(e, node.id, node.x, node.y)}
                        onDelete={() => deleteNode(node.id)}
                    />
                ))}
            </div>
            {selectedNode && (
                <EditPanel
                    node={selectedNode}
                    flowState={flowState}
                    onClose={() => setSelectedNodeId(null)}
                    onSave={updateNodeProperty}
                    onAddEdge={addEdge}
                    onDeleteEdge={deleteEdge}
                />
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// CHATBOT WIDGET
// ═══════════════════════════════════════════════════════════════════════════

const ChatMessage = ({ msg }) => (
    <div
        style={{
            display: "flex",
            justifyContent: msg.role === "bot" ? "flex-start" : "flex-end",
            animation: "fadeSlideUp 0.22s ease-out",
        }}
    >
        <div
            style={{
                maxWidth: "82%",
                borderRadius: msg.role === "bot" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                padding: "8px 12px",
                fontSize: 12.5,
                background: msg.role === "bot" ? "#f1f5f9" : "#6366f1",
                color: msg.role === "bot" ? "#1e293b" : "#fff",
                lineHeight: 1.5,
            }}
        >
            {msg.text}
            {msg.timestamp && (
                <div style={{ fontSize: 9.5, opacity: 0.6, marginTop: 3, textAlign: "right" }}>{msg.timestamp}</div>
            )}
        </div>
    </div>
);

const ChatbotWidget = ({ flowState }) => {
    const { isOpen, setIsOpen, chatHistory, currentNodeId, selectOption, resetChat, getOptions, isLeaf } = useChatbot(flowState);
    const messagesEndRef = useRef(null);
    const options = useMemo(() => (currentNodeId ? getOptions(currentNodeId) : []), [currentNodeId, getOptions]);
    const endReached = isLeaf(currentNodeId);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: "fixed", bottom: 24, right: 24,
                    width: 56, height: 56, borderRadius: "50%",
                    background: "#6366f1", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 8px 24px rgba(99,102,241,0.45)",
                    fontSize: 22, color: "#fff", zIndex: 50,
                    transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                title="Open chat"
            >💬</button>
        );
    }

    return (
        <div style={{
            position: "fixed", bottom: 24, right: 24,
            width: 372, height: 540,
            background: "#fff", borderRadius: 20,
            boxShadow: "0 24px 48px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.05)",
            display: "flex", flexDirection: "column", zIndex: 50, overflow: "hidden",
            animation: "fadeSlideUp 0.22s ease-out",
            fontFamily: "DM Sans, sans-serif",
        }}>
            {/* Header */}
            <div style={{ background: "#4f46e5", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontSize: 18 }}>🤖</div>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>SupportFlow AI</span>
                </div>
                <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                {chatHistory.map((msg) => <ChatMessage key={msg.id} msg={msg} />)}

                {options.length > 0 && !endReached && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => selectOption(opt)}
                                style={{
                                    background: "#fff", border: "1px solid #cbd5e1", borderRadius: 20,
                                    padding: "5px 12px", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                                    transition: "border-color 0.15s", fontFamily: "DM Sans, sans-serif",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#6366f1"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#1e293b"; }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {endReached && currentNodeId && (
                    <div style={{ textAlign: "center", paddingTop: 6 }}>
                        <button onClick={resetChat} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                            ↺ Start over
                        </button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Footer */}
            <div style={{ padding: "8px 12px", borderTop: "1px solid #f1f5f9", textAlign: "center", fontSize: 10, color: "#94a3b8" }}>
                Bot follows the visual flow tree
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════

const Sidebar = ({ activePage, onNavigate }) => (
    <aside style={{
        width: 220, background: "#0f172a", display: "flex", flexDirection: "column",
        boxShadow: "2px 0 16px rgba(0,0,0,0.15)", flexShrink: 0,
        fontFamily: "DM Sans, sans-serif",
    }}>
        {/* Brand */}
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 13 }}>SF</div>
                <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 15 }}>SupportFlow</span>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 4, marginLeft: 42 }}>Visual Builder</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px" }}>
            {NAV_ITEMS.map(({ key, label, icon }) => {
                const active = activePage === key;
                return (
                    <button
                        key={key}
                        onClick={() => onNavigate(key)}
                        style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                            padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                            background: active ? "rgba(99,102,241,0.18)" : "transparent",
                            color: active ? "#818cf8" : "#94a3b8",
                            fontSize: 13, fontWeight: active ? 600 : 400,
                            textAlign: "left", marginBottom: 2,
                            transition: "background 0.15s, color 0.15s",
                            fontFamily: "DM Sans, sans-serif",
                        }}
                        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#e2e8f0"; } }}
                        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
                    >
                        <span style={{ fontSize: 15, opacity: 0.9 }}>{icon}</span>
                        {label}
                    </button>
                );
            })}
        </nav>

        {/* User */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#94a3b8", fontSize: 12 }}>SC</div>
            <div>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "#e2e8f0" }}>Sangwa Cedric</p>
                <p style={{ fontSize: 10.5, color: "#64748b" }}>Admin</p>
            </div>
        </div>
    </aside>
);

// ═══════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════

const Toast = ({ message }) => (
    <div style={{
        position: "fixed", bottom: 96, right: 24, zIndex: 200,
        background: "#1e293b", color: "#f8fafc",
        padding: "8px 18px", borderRadius: 50,
        fontSize: 12.5, fontWeight: 500,
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        animation: "fadeSlideUp 0.2s ease-out",
        fontFamily: "DM Sans, sans-serif",
    }}>
        {message}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STYLES (injected once)
// ═══════════════════════════════════════════════════════════════════════════

const GlobalStyles = () => (
    <style>{`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; background: #f1f5f9; }
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════════
// SHARED STYLE TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
    pageTitle: { fontSize: 22, fontWeight: 700, color: "#0f172a", fontFamily: "DM Sans, sans-serif" },
    card: { background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
    input: { display: "block", width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "DM Sans, sans-serif", outline: "none", marginTop: 4 },
    primaryBtn: { display: "block", width: "100%", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif" },
    linkBtn: { background: "none", border: "none", color: "#6366f1", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif" },
    formLabel: { display: "flex", flexDirection: "column", fontSize: 13, fontWeight: 600, color: "#374151" },
    iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#94a3b8", padding: 4 },
    toolBtn: { border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "DM Sans, sans-serif", transition: "background 0.15s" },
};

// ═══════════════════════════════════════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_COMPONENTS = {
    dashboard: DashboardPage,
    analytics: AnalyticsPage,
    templates: TemplatesPage,
    settings: SettingsPage,
};

export default function App() {
    const [activePage, setActivePage] = useState("flow-builder");
    const { flowState, updateFlow, undo, redo, pushHistory } = useFlowState();
    const { toast, showToast } = useToast();

    const ActiveComponent = activePage !== "flow-builder" ? PAGE_COMPONENTS[activePage] : null;

    return (
        <>
            <GlobalStyles />
            <FontLoader />
            <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {activePage === "flow-builder" ? (
                        <FlowBuilder
                            flowState={flowState}
                            updateFlow={updateFlow}
                            undo={undo}
                            redo={redo}
                            pushHistory={pushHistory}
                            showToast={showToast}
                        />
                    ) : (
                        ActiveComponent ? <ActiveComponent /> : null
                    )}
                </main>
                <ChatbotWidget flowState={flowState} />
                {toast && <Toast message={toast} />}
            </div>
        </>
    );
}