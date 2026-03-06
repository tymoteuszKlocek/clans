import { useEffect, useRef, useCallback } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";
import { createNodeBorderProgram } from "@sigma/node-border";
import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import ForceSupervisor from "graphology-layout-force/worker";
import { useGraphData } from "../hooks/useGraphData";
import type { UserNode } from "../types";

// 200 distinct colors via golden angle HSL
const FAMILY_COLORS: string[] = [];
for (let i = 0; i < 200; i++) {
    const hue = Math.round((i * 137.508) % 360);
    const sat = 60 + (i % 3) * 10;
    const light = 45 + (i % 4) * 7;
    const r = hslToHex(hue, sat, light);
    FAMILY_COLORS.push(r);
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const GREY = "#bbbbbb";

const GraphView = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sigmaRef = useRef<Sigma | null>(null);
    const layoutRef = useRef<ForceSupervisor | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const { users, edges, loading } = useGraphData();

    const buildGraph = useCallback(() => {
        if (!containerRef.current || users.length === 0) return;

        // Cleanup previous
        if (layoutRef.current) { layoutRef.current.kill(); layoutRef.current = null; }
        if (sigmaRef.current) { sigmaRef.current.kill(); sigmaRef.current = null; }

        const graph = new Graph();
        const allUserIds = new Set(users.map((u) => u.id));

        // Collect ALL family pairs from both sources
        const familyPairSet = new Set<string>();
        const familyPairs: Array<{ source: string; target: string }> = [];

        const addPair = (source: string, target: string) => {
            const key = `${source}->${target}`;
            if (familyPairSet.has(key)) return;
            familyPairSet.add(key);
            familyPairs.push({ source, target });
        };

        edges.forEach((edge) => {
            if (edge.type === "family" && allUserIds.has(edge.source) && allUserIds.has(edge.target)) {
                addPair(edge.source, edge.target);
            }
        });

        users.forEach((user) => {
            if (user.fatherId && allUserIds.has(user.fatherId)) addPair(user.fatherId, user.id);
            if (user.motherId && allUserIds.has(user.motherId)) addPair(user.motherId, user.id);
        });

        const inFamily = new Set<string>();
        familyPairs.forEach(({ source, target }) => { inFamily.add(source); inFamily.add(target); });
        users.forEach((u) => {
            if (u.fatherId && allUserIds.has(u.fatherId)) { inFamily.add(u.id); inFamily.add(u.fatherId); }
            if (u.motherId && allUserIds.has(u.motherId)) { inFamily.add(u.id); inFamily.add(u.motherId); }
            if (users.some((c) => c.fatherId === u.id || c.motherId === u.id)) inFamily.add(u.id);
        });

        // Count children
        const childCount: Record<string, number> = {};
        familyPairs.forEach(({ source }) => {
            childCount[source] = (childCount[source] || 0) + 1;
        });

        // Union-Find
        const uf: Record<string, string> = {};
        const rank: Record<string, number> = {};
        allUserIds.forEach((id) => { uf[id] = id; rank[id] = 0; });

        const find = (x: string): string => {
            if (uf[x] !== x) uf[x] = find(uf[x]);
            return uf[x];
        };
        const union = (a: string, b: string) => {
            const ra = find(a), rb = find(b);
            if (ra === rb) return;
            if (rank[ra] < rank[rb]) uf[ra] = rb;
            else if (rank[ra] > rank[rb]) uf[rb] = ra;
            else { uf[rb] = ra; rank[ra]++; }
        };

        familyPairs.forEach(({ source, target }) => union(source, target));

        // Assign colors by SURNAME (married couples share color)
        const surnameColorMap: Record<string, string> = {};
        let ci = 0;

        // First pass: assign base color per surname
        users.forEach((user) => {
            if (!surnameColorMap[user.surname]) {
                surnameColorMap[user.surname] = FAMILY_COLORS[ci++ % FAMILY_COLORS.length];
            }
        });

        // Determine generation depth for lighter shades
        // gen 0 = oldest (no parents in system), gen 1 = their children, etc.
        const genCache: Record<string, number> = {};
        const userMap = new Map(users.map((u) => [u.id, u]));

        const getGeneration = (userId: string, visited: Set<string> = new Set()): number => {
            if (genCache[userId] !== undefined) return genCache[userId];
            if (visited.has(userId)) return 0;
            visited.add(userId);

            const user = userMap.get(userId);
            if (!user) return 0;

            let parentGen = -1;
            if (user.fatherId && userMap.has(user.fatherId)) {
                parentGen = Math.max(parentGen, getGeneration(user.fatherId, visited));
            }
            if (user.motherId && userMap.has(user.motherId)) {
                parentGen = Math.max(parentGen, getGeneration(user.motherId, visited));
            }

            genCache[userId] = parentGen + 1;
            return genCache[userId];
        };

        users.forEach((u) => getGeneration(u.id));

        // Lighten a hex color by generation
        const lightenHex = (hex: string, generation: number): string => {
            const factor = Math.min(generation * 0.18, 0.6); // max 60% lighter
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const lr = Math.round(r + (255 - r) * factor);
            const lg = Math.round(g + (255 - g) * factor);
            const lb = Math.round(b + (255 - b) * factor);
            return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
        };

        // Get color for a user: use spouse's surname color if married into family
        const getUserColor = (user: UserNode): string => {
            const gen = genCache[user.id] || 0;

            // If user has parents in system, use parents' surname color
            // (child takes parents' family color, even if surname differs due to marriage)
            const father = user.fatherId ? userMap.get(user.fatherId) : null;
            const mother = user.motherId ? userMap.get(user.motherId) : null;

            let baseColor: string;

            if (father) {
                baseColor = surnameColorMap[father.surname] || surnameColorMap[user.surname];
            } else if (mother) {
                baseColor = surnameColorMap[mother.surname] || surnameColorMap[user.surname];
            } else {
                baseColor = surnameColorMap[user.surname];
            }

            return lightenHex(baseColor, gen);
        };

        // Detect spouse pairs from spouseId field AND shared children
        const spousePairs = new Set<string>();

        // From spouseId field
        users.forEach((user) => {
            if (user.spouseId && allUserIds.has(user.spouseId)) {
                const key = [user.id, user.spouseId].sort().join("|");
                spousePairs.add(key);
            }
        });

        // From shared children
        users.forEach((child) => {
            if (child.fatherId && child.motherId && allUserIds.has(child.fatherId) && allUserIds.has(child.motherId)) {
                const key = [child.fatherId, child.motherId].sort().join("|");
                spousePairs.add(key);
            }
        });

        // Add nodes — offset spouses so they don't overlap
        const spouseOffsets = new Map<string, number>();
        let offsetCounter = 0;

        users.forEach((user) => {
            const kids = childCount[user.id] || 0;
            const size = 8 + kids * 5;
            const color = inFamily.has(user.id) ? getUserColor(user) : GREY;

            // Give spouses a slight x-offset from each other
            let xOffset = 0;
            spousePairs.forEach((pair) => {
                const [a, b] = pair.split("|");
                if (user.id === a || user.id === b) {
                    if (!spouseOffsets.has(pair)) {
                        spouseOffsets.set(pair, offsetCounter++);
                    }
                    xOffset = user.id === a ? -3 : 3;
                }
            });

            graph.addNode(user.id, {
                label: `${user.name} ${user.surname}`,
                x: Math.random() * 10 - 5 + xOffset,
                y: Math.random() * 10 - 5,
                size,
                color,
                _isParent: kids > 0,
                _userData: user,
            });
        });

        // Add edges
        const addedEdges = new Set<string>();
        const tryEdge = (src: string, tgt: string, type: "family" | "community") => {
            if (!graph.hasNode(src) || !graph.hasNode(tgt)) return;
            const k = `${src}|${tgt}`;
            const kr = `${tgt}|${src}`;
            if (addedEdges.has(k) || addedEdges.has(kr)) return;
            addedEdges.add(k);
            const nodeColor = graph.getNodeAttribute(src, "color") as string;
            const edgeColor = type === "family"
                ? hexToRgba(nodeColor.startsWith("#") ? nodeColor : "#cc4466", 0.55)
                : "rgba(120, 120, 120, 0.35)";
            try {
                graph.addEdge(src, tgt, {
                    color: edgeColor,
                    size: type === "family" ? 2.5 : 1.5,
                    type: "arrow",
                });
            } catch { /* skip */ }
        };

        edges.forEach((e) => tryEdge(e.source, e.target, e.type));
        users.forEach((u) => {
            if (u.fatherId) tryEdge(u.fatherId, u.id, "family");
            if (u.motherId) tryEdge(u.motherId, u.id, "family");
        });

        edges.forEach((e) => tryEdge(e.source, e.target, e.type));
        users.forEach((u) => {
            if (u.fatherId) tryEdge(u.fatherId, u.id, "family");
            if (u.motherId) tryEdge(u.motherId, u.id, "family");
        });

        // Spouse edges (visible, thick, with heart)
        spousePairs.forEach((pair) => {
            const [a, b] = pair.split("|");
            if (graph.hasNode(a) && graph.hasNode(b)) {
                const key = `${a}|${b}`;
                if (!addedEdges.has(key) && !addedEdges.has(`${b}|${a}`)) {
                    addedEdges.add(key);
                    const colorA = graph.getNodeAttribute(a, "color") as string;
                    try {
                        graph.addEdge(a, b, {
                            color: hexToRgba(colorA.startsWith("#") ? colorA : "#e94560", 0.8),
                            size: 3,
                            type: "curvedArrow",
                            curvature: 0.3,
                            label: "❤️",
                        });
                    } catch { /* skip */ }
                }
            }
        });

        // Force layout
        const layout = new ForceSupervisor(graph, {
            isNodeFixed: (_n: string, attr: Record<string, unknown>) =>
                (attr as { highlighted?: boolean }).highlighted === true,
            settings: {
                attraction: 0.0015,
                repulsion: 0.8,
                gravity: 0.0008,
                inertia: 0.6,
                maxMove: 200,
            },
        });
        layout.start();
        layoutRef.current = layout;

        // After layout settles, push spouses apart
        setTimeout(() => {
            spousePairs.forEach((pair) => {
                const [a, b] = pair.split("|");
                if (!graph.hasNode(a) || !graph.hasNode(b)) return;
                const ax = graph.getNodeAttribute(a, "x") as number;
                const ay = graph.getNodeAttribute(a, "y") as number;
                const bx = graph.getNodeAttribute(b, "x") as number;
                const by = graph.getNodeAttribute(b, "y") as number;

                const dx = bx - ax;
                const dy = by - ay;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const minDist = 2.5;
                if (dist < minDist) {
                    // Push them apart perpendicular to their children's direction
                    const pushX = dist < 0.01 ? minDist / 2 : (dx / dist) * minDist / 2;
                    const pushY = dist < 0.01 ? 0 : (dy / dist) * minDist / 2;

                    // If they're nearly on top of each other, push horizontally
                    if (dist < 0.01) {
                        graph.setNodeAttribute(a, "x", ax - minDist / 2);
                        graph.setNodeAttribute(b, "x", bx + minDist / 2);
                    } else {
                        graph.setNodeAttribute(a, "x", ax - pushX);
                        graph.setNodeAttribute(a, "y", ay - pushY);
                        graph.setNodeAttribute(b, "x", bx + pushX);
                        graph.setNodeAttribute(b, "y", by + pushY);
                    }
                }
            });
        }, 3000);

        // Keep pushing apart every few seconds
        const spouseInterval = setInterval(() => {
            spousePairs.forEach((pair) => {
                const [a, b] = pair.split("|");
                if (!graph.hasNode(a) || !graph.hasNode(b)) return;
                const ax = graph.getNodeAttribute(a, "x") as number;
                const ay = graph.getNodeAttribute(a, "y") as number;
                const bx = graph.getNodeAttribute(b, "x") as number;
                const by = graph.getNodeAttribute(b, "y") as number;

                const dx = bx - ax;
                const dy = by - ay;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 2) {
                    if (dist < 0.01) {
                        graph.setNodeAttribute(a, "x", ax - 1.5);
                        graph.setNodeAttribute(b, "x", bx + 1.5);
                    } else {
                        const pushX = (dx / dist) * 1.5;
                        const pushY = (dy / dist) * 1.5;
                        graph.setNodeAttribute(a, "x", ax - pushX);
                        graph.setNodeAttribute(a, "y", ay - pushY);
                        graph.setNodeAttribute(b, "x", bx + pushX);
                        graph.setNodeAttribute(b, "y", by + pushY);
                    }
                }
            });
        }, 2000);

        // Sigma
        const NodeBorderProgram = createNodeBorderProgram({
            borders: [
                { size: { value: 0.2 }, color: { attribute: "color" } },
                { size: { fill: true }, color: { value: "#ffffff" } },
            ],
        });

        const sigma = new Sigma(graph, containerRef.current!, {
            renderEdgeLabels: true,
            defaultEdgeType: "arrow",
            edgeProgramClasses: {
                arrow: EdgeArrowProgram,
                curvedArrow: EdgeCurvedArrowProgram,
            },
            defaultNodeType: "bordered",
            nodeProgramClasses: { bordered: NodeBorderProgram },
            labelRenderedSizeThreshold: 0,
            defaultNodeColor: GREY,
            minCameraRatio: 0.1,
            maxCameraRatio: 10,
        });

        // Draw nodes as rings (unfilled circles with colored border)
        sigma.setSetting("nodeReducer", (_node, data) => {
            return {
                ...data,
                borderColor: data.color,
                borderSize: 3,
                color: "#ffffff",
            };
        });

        // sigma.setSetting("nodeBorderColor", { attribute: "borderColor" });
        // sigma.setSetting("defaultNodeBorderSize", 3);
        // sigma.setSetting("defaultNodeBorderColor", GREY);

        // Hover: show label for non-parent nodes + tooltip
        sigma.setSetting("nodeReducer", (_node, data) => {
            const res = { ...data };
            // const hovered = sigma.getCustomBBox()
            //     ? false
            //     : (containerRef.current?.querySelector(":hover") ? true : false);
            return res;
        });

        // Drag
        let draggedNode: string | null = null;
        let isDragging = false;

        sigma.on("downNode", (e) => {
            isDragging = true;
            draggedNode = e.node;
            graph.setNodeAttribute(draggedNode, "highlighted", true);
        });

        sigma.getMouseCaptor().on("mousemovebody", (e) => {
            if (!isDragging || !draggedNode) return;
            const pos = sigma.viewportToGraph(e);
            graph.setNodeAttribute(draggedNode, "x", pos.x);
            graph.setNodeAttribute(draggedNode, "y", pos.y);
            e.preventSigmaDefault();
            e.original.preventDefault();
            e.original.stopPropagation();
        });

        sigma.getMouseCaptor().on("mouseup", () => {
            if (draggedNode) graph.removeNodeAttribute(draggedNode, "highlighted");
            isDragging = false;
            draggedNode = null;
        });

        // Hover tooltip
        sigma.on("enterNode", ({ node }) => {
            const attrs = graph.getNodeAttributes(node);
            const userData = attrs._userData as UserNode;

            // Force show label
            graph.setNodeAttribute(node, "forceLabel", true);

            if (tooltipRef.current && userData) {
                let html = `<strong>${userData.name} ${userData.surname}</strong>`;
                if (userData.dateOfBirth) html += `<br>🎂 ${userData.dateOfBirth}`;
                if (userData.city) html += `<br>📍 ${userData.city}`;
                if (userData.community) html += `<br>👥 ${userData.community}`;
                if (userData.otherInfo) html += `<br>ℹ️ ${userData.otherInfo}`;
                tooltipRef.current.innerHTML = html;
                tooltipRef.current.style.display = "block";
            }
        });

        sigma.on("leaveNode", ({ node }) => {
            const isParent = graph.getNodeAttribute(node, "_isParent");
            if (!isParent) graph.setNodeAttribute(node, "forceLabel", false);
            if (tooltipRef.current) tooltipRef.current.style.display = "none";
        });

        sigmaRef.current = sigma;

        return () => {
            layout.kill();
            sigma.kill();
            layoutRef.current = null;
            sigmaRef.current = null;
            clearInterval(spouseInterval);
        };
    }, [users, edges]);

    useEffect(() => {
        const cleanup = buildGraph();
        return () => { if (cleanup) cleanup(); };
    }, [buildGraph]);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                Loading graph...
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#888" }}>
                No users yet. Go to Admin Panel to add some!
            </div>
        );
    }

    return (
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 51px)" }}>
            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

            <div
                ref={tooltipRef}
                style={{
                    display: "none",
                    position: "absolute",
                    top: 20,
                    right: 20,
                    background: "rgba(255,255,255,0.95)",
                    padding: "14px 18px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                    maxWidth: "280px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    pointerEvents: "none",
                    zIndex: 10,
                }}
            />
            <button
                className="btn-secondary"
                onClick={() => {
                    if (sigmaRef.current) {
                        const current = sigmaRef.current.getSetting("labelRenderedSizeThreshold");
                        sigmaRef.current.setSetting("labelRenderedSizeThreshold", current === 0 ? 12 : 0);
                    }
                }}
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 10,
                    padding: "8px 14px",
                    fontSize: "13px",
                }}
            >
                🏷️ Toggle Labels
            </button>
            <div className="legend">
                <p style={{ fontSize: "11px", color: "#666", margin: "0 0 4px" }}>⬤ Bigger = more children</p>
                <p style={{ fontSize: "11px", color: "#666", margin: "0 0 4px" }}>🎨 Same color = same family</p>
                <p style={{ fontSize: "11px", color: "#666", margin: "0 0 4px" }}>➡️ Arrow: parent → child</p>
                <p style={{ fontSize: "11px", color: "#666", margin: "0 0 4px" }}>🖱️ Hover for name & details</p>
                <p style={{ fontSize: "11px", color: "#666", margin: "0" }}>✋ Drag to rearrange</p>
            </div>
        </div>
    );
};

export default GraphView;