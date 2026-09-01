import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  FileSignature, PenTool, Search, PieChart, Settings, LogOut, 
  Menu, X, Save, FileText, Plus, Trash2, Building, Receipt, 
  Bot, Download, CheckCircle, AlertTriangle, FileUp, Globe,
  Handshake, Clock, FileWarning, Key, Box, Camera, Ruler, 
  Info, Grid, Wrench, Video, Layers, Minimize2, Maximize2, 
  RefreshCw, Move, ChevronLeft, ChevronRight, Edit, ChevronDown,
  Package, Archive, DollarSign, ShieldAlert, Upload, Eye
} from 'lucide-react';

const SUPABASE_URL = "https://iwpsxftmwbsvjdktlidk.supabase.co/";
const SUPABASE_REST_URL = "https://iwpsxftmwbsvjdktlidk.supabase.co/rest/v1/";
const SUPABASE_AUTH_URL = "https://iwpsxftmwbsvjdktlidk.supabase.co/auth/v1/";
const SUPABASE_KEY = "sb_publishable_KCGnYnt31h45QuNhHLFvxA_0MuQAaq6";

const defaultLogoBase64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMjAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSIyMjAiIGhlaWdodD0iNjAiIGZpbGw9IiNmZmZmZmYiLz48dGV4dCB4PSIxMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMxNDMyNWEiPkthbGVuYm9ybjwvdGV4dD48L3N2Zz4=";

const SPECIAL_ICMS_PRODUCTS = ['3083', '16511', '4606', '4608', '4610', '4609', '4613', '4612', '4611', '17658'];

// ==========================================
// SESSÃO (Supabase Auth)
// ==========================================
function clearSession() {
  localStorage.removeItem('kbn_auth');
  localStorage.removeItem('kbn_user');
  localStorage.removeItem('kbn_supabase_token');
  localStorage.removeItem('kbn_supabase_refresh_token');
  window.dispatchEvent(new Event('kbn-session-expired'));
}

async function refreshSupabaseToken() {
  const refreshToken = localStorage.getItem('kbn_supabase_refresh_token');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${SUPABASE_AUTH_URL}token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    localStorage.setItem('kbn_supabase_token', data.access_token);
    localStorage.setItem('kbn_supabase_refresh_token', data.refresh_token);
    return data.access_token;
  } catch (e) { return null; }
}

async function supabaseRequest(table, method = 'GET', body = null, merge = false, _retry = false) {
  const token = localStorage.getItem('kbn_supabase_token') || SUPABASE_KEY;
  const headers = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  if (merge && method === 'POST') headers["Prefer"] = "resolution=merge-duplicates";
  else headers["Prefer"] = "return=representation";
  let url = `${SUPABASE_REST_URL}${table}`;
  const options = { method, headers };
  if (method === 'PATCH' && body?.id) {
    url = `${SUPABASE_REST_URL}${table}?id=eq.${body.id}`;
    const cleanBody = { ...body }; delete cleanBody.id; options.body = JSON.stringify(cleanBody);
  } else if (body) { options.body = JSON.stringify(body); }
  const response = await fetch(url, options);
  if (response.status === 401 && !_retry) {
    const newToken = await refreshSupabaseToken();
    if (newToken) return supabaseRequest(table, method, body, merge, true);
    clearSession();
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (!response.ok) throw new Error(await response.text());
  if (method === 'DELETE' || response.status === 204 || response.status === 201) return {};
  const responseText = await response.text();
  try { return responseText ? JSON.parse(responseText) : {}; } catch (e) { return {}; }
}

async function supabaseUpload(bucket, path, file, _retry = false) {
  const token = localStorage.getItem('kbn_supabase_token') || SUPABASE_KEY;
  const url = `${SUPABASE_URL}storage/v1/object/${bucket}/${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": file.type || 'application/pdf' },
    body: file
  });
  if (response.status === 401 && !_retry) {
    const newToken = await refreshSupabaseToken();
    if (newToken) return supabaseUpload(bucket, path, file, true);
    clearSession();
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (!response.ok) {
    const err = await response.json();
    if (err.error === "Duplicate") return `${SUPABASE_URL}storage/v1/object/public/${bucket}/${path}`;
    throw new Error(`Erro Upload: ${err.message}`);
  }
  return `${SUPABASE_URL}storage/v1/object/public/${bucket}/${path}`;
}

async function supabaseRequestPaged(table, pageSize = 1000, _retry = false) {
  let all = [];
  let from = 0;
  while (true) {
    const token = localStorage.getItem('kbn_supabase_token') || SUPABASE_KEY;
    const res = await fetch(`${SUPABASE_REST_URL}${table}`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Range-Unit": "items",
        "Range": `${from}-${from + pageSize - 1}`
      }
    });
    if (res.status === 401 && !_retry) {
      const newToken = await refreshSupabaseToken();
      if (newToken) { _retry = true; continue; }
      clearSession();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (!res.ok && res.status !== 206) throw new Error(await res.text());
    const page = await res.json();
    all = all.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const formatCNPJ = (c) => {
  if (!c) return '';
  const clean = String(c).replace(/\D/g, '');
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const formatNum = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const getAutoIcms = (address, codOrigem, productId = null) => {
  const isSpecial = SPECIAL_ICMS_PRODUCTS.includes(String(productId));
  if (!address) return isSpecial ? '18%' : '18%';
  const upperAddress = address.toUpperCase();
  const isMG = /\b(MG|MINAS GERAIS)\b/.test(upperAddress) || upperAddress.includes('-MG') || upperAddress.includes('/MG');
  if (isSpecial) return isMG ? '18%' : '4%';
  if (isMG) return '18%';
  const isImported = ['1', '2', '3', '8'].includes(String(codOrigem).trim());
  if (isImported) return '4%';
  const sudesteSul = ['SP', 'SÃO PAULO', 'SAO PAULO', 'RJ', 'RIO DE JANEIRO', 'PR', 'PARANÁ', 'PARANA', 'SC', 'SANTA CATARINA', 'RS', 'RIO GRANDE DO SUL'];
  if (sudesteSul.some(state => upperAddress.includes(` ${state}`) || upperAddress.includes(`-${state}`) || upperAddress.includes(`/${state}`))) return '12%';
  return '7%';
};

const calculateGrossPrice = (liquidPrice, icmsString, pisCofinsString) => {
  const icms = parseFloat(String(icmsString).replace('%', '')) || 0;
  const pisCofins = parseFloat(String(pisCofinsString).replace('%', '')) || 0;
  const totalTaxes = (icms + pisCofins) / 100;
  if (totalTaxes >= 1) return liquidPrice;
  return liquidPrice / (1 - totalTaxes);
};

const calculateProposalTotals = (items, descontoPct) => {
  let subtotalBrutoSemIpi = 0, totalIpi = 0, subtotalLiquido = 0;
  items.forEach(it => {
    const gross = calculateGrossPrice(it.price, it.icms, it.pisCofins);
    const ipi = parseFloat(it.ipi || 0);
    const itemTotalBruto = gross * it.quantity;
    subtotalBrutoSemIpi += itemTotalBruto;
    totalIpi += itemTotalBruto * (ipi / 100);
    subtotalLiquido += (it.price * it.quantity);
  });
  const desc = parseFloat(descontoPct) || 0;
  const valorDesconto = subtotalBrutoSemIpi * (desc / 100);
  const totalFinal = (subtotalBrutoSemIpi - valorDesconto) + totalIpi;
  return { subtotalBruto: subtotalBrutoSemIpi, subtotalLiquido, totalIpi, total: totalFinal, valorDesconto };
};

const getEmptyProposal = () => ({
  id: '', numeroUnico: '', status: 'Pendente', clientId: '', items: [], attachment_url: null,
  config: { projeto: 'Gerado Automático', date: new Date().toLocaleDateString('pt-BR'), emissor: 'Comercial Kalenborn', contato: '', referencia: '', observacoesAdicionais: '', condicaoPagamento: '30 Dias', transporte: 'CIF', naturezaOperacao: 'Venda para Consumo', desconto: 0, icmsDestino: '18%' },
  total: 0
});

async function askChatGPT(prompt, apiKey, expectJson = false) {
  if (!apiKey) throw new Error("Chave API ausente.");
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], ...(expectJson && { response_format: { type: "json_object" } }) })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// ==========================================
// BANCO DE DADOS DO SIMULADOR 3D - COMPLETO (12 MODELOS)
// ==========================================
const simulatorDatabase = {
    'WPHSKRX-774': {
        id: 'WPHSKRX-774-KLC_REV.6', type: 'Placa Padrão com ABA e Cerâmicas', dimsStr: '380 x 490 x 35 mm', screwStr: 'M20x50',
        parts: [
            { name: 'Base_Aço', type: 'box', size: [38, 49, 1], pos: [0,0,-1.25], explodedPos: [0,0,-15], color: 0x475569 },
            { name: 'Borda_Esq', type: 'box', size: [0.7, 49, 3.5], pos: [-18.65, 0, 0], explodedPos: [-18.65, 0, -15], color: 0x475569 },
            { name: 'Borda_Dir', type: 'box', size: [0.7, 49, 3.5], pos: [18.65, 0, 0], explodedPos: [18.65, 0, -15], color: 0x475569 },
            { name: 'Borda_Sup', type: 'box', size: [36.6, 0.9, 3.5], pos: [0, 24.05, 0], explodedPos: [0, 24.05, -15], color: 0x475569 },
            { name: 'Borda_Inf', type: 'box', size: [36.6, 0.9, 3.5], pos: [0, -24.05, 0], explodedPos: [0, -24.05, -15], color: 0x475569 },
            { name: 'Ceramica_1_1', type: 'box', size: [15, 10, 2.5], pos: [-10.8, 18.6, 0.5], explodedPos: [-10.8, 18.6, 15], color: 0xffffff },
            { name: 'Ceramica_1_2', type: 'box', size: [15, 10, 2.5], pos: [4.2, 18.6, 0.5], explodedPos: [4.2, 18.6, 15], color: 0xffffff },
            { name: 'Ceramica_1_3A', type: 'box', size: [6.6, 10, 2.5], pos: [15.0, 18.6, 0.5], explodedPos: [15.0, 18.6, 15], color: 0xffffff },
            { name: 'Ceramica_2_1A', type: 'box', size: [6.6, 10, 2.5], pos: [-15.0, 8.6, 0.5], explodedPos: [-15.0, 8.6, 15], color: 0xffffff },
            { name: 'Ceramica_2_2', type: 'box', size: [15, 10, 2.5], pos: [-4.2, 8.6, 0.5], explodedPos: [-4.2, 8.6, 15], color: 0xffffff },
            { name: 'Ceramica_2_3', type: 'box', size: [15, 10, 2.5], pos: [10.8, 8.6, 0.5], explodedPos: [10.8, 8.6, 15], color: 0xffffff },
            { name: 'Ceramica_3_1', type: 'box', size: [15, 10, 2.5], pos: [-10.8, -1.4, 0.5], explodedPos: [-10.8, -1.4, 15], color: 0xffffff },
            { name: 'Ceramica_3_2', type: 'box', size: [15, 10, 2.5], pos: [4.2, -1.4, 0.5], explodedPos: [4.2, -1.4, 15], color: 0xffffff },
            { name: 'Ceramica_3_3A', type: 'box', size: [6.6, 10, 2.5], pos: [15.0, -1.4, 0.5], explodedPos: [15.0, -1.4, 15], color: 0xffffff },
            { name: 'Ceramica_4_1A', type: 'box', size: [6.6, 10, 2.5], pos: [-15.0, -11.4, 0.5], explodedPos: [-15.0, -11.4, 15], color: 0xffffff },
            { name: 'Ceramica_4_2', type: 'box', size: [15, 10, 2.5], pos: [-4.2, -11.4, 0.5], explodedPos: [-4.2, -11.4, 15], color: 0xffffff },
            { name: 'Ceramica_4_3', type: 'box', size: [15, 10, 2.5], pos: [10.8, -11.4, 0.5], explodedPos: [10.8, -11.4, 15], color: 0xffffff },
            { name: 'Ceramica_5_1B', type: 'box', size: [15, 7.2, 2.5], pos: [-10.8, -20.0, 0.5], explodedPos: [-10.8, -20.0, 15], color: 0xffffff },
            { name: 'Ceramica_5_2B', type: 'box', size: [15, 7.2, 2.5], pos: [4.2, -20.0, 0.5], explodedPos: [4.2, -20.0, 15], color: 0xffffff },
            { name: 'Ceramica_5_3C', type: 'box', size: [6.6, 7.2, 2.5], pos: [15.0, -20.0, 0.5], explodedPos: [15.0, -20.0, 15], color: 0xffffff },
            { name: 'Parafuso_1', type: 'cylinder', radius: 1, height: 6, pos: [0, 20, -1.25], explodedPos: [0, 20, -20], color: 0x111111 },
            { name: 'Parafuso_2', type: 'cylinder', radius: 1, height: 6, pos: [0, 0, -1.25], explodedPos: [0, 0, -20], color: 0x111111 },
            { name: 'Parafuso_3', type: 'cylinder', radius: 1, height: 6, pos: [0, -20, -1.25], explodedPos: [0, -20, -20], color: 0x111111 }
        ],
        measures: [
            { text: '380 mm', start: [-19, -26, 0], end: [19, -26, 0] },
            { text: '490 mm', start: [21, -24.5, 0], end: [21, 24.5, 0] },
            { text: '35 mm', start: [-21, 24, -1.25], end: [-21, 24, 2.25] }
        ]
    },
    'DES-KBWPKLT-1510': {
        id: 'DES-KBWPKLT-1510_REV.1', type: 'Placa Padrão Vertical (Sem ABA)', dimsStr: '40 x 380 x 490 mm', screwStr: '3x Prisioneiros M20x50',
        parts: (function() {
            const p = [
                { name: 'Base_Aço', type: 'box', size: [38, 49, 1.5], pos: [0, 0, -0.75], explodedPos: [0, 0, -15], color: 0x475569 },
                { name: 'Matriz_Borracha', type: 'box', size: [38, 49, 2.4], pos: [0, 0, 1.2], explodedPos: [0, 0, -5], color: 0x111111 },
                { name: 'Parafuso_1', type: 'cylinder', radius: 1.0, height: 6, pos: [0, 20, -2.5], explodedPos: [0, 20, -20], color: 0x111111 },
                { name: 'Parafuso_2', type: 'cylinder', radius: 1.0, height: 6, pos: [0, 0, -2.5], explodedPos: [0, 0, -20], color: 0x111111 },
                { name: 'Parafuso_3', type: 'cylinder', radius: 1.0, height: 6, pos: [0, -20, -2.5], explodedPos: [0, -20, -20], color: 0x111111 }
            ];
            const w = 4.4; const gapX = 0.4; const gapY = 0.28; const zCeramica = 1.25; const zExploded = 15; let startX = -16.8;
            for (let col = 0; col < 8; col++) {
                let currentX = startX + col * (w + gapX);
                let isSmallTop = (col % 2 === 0);
                let pieces = isSmallTop ? [2.2, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4] : [4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 2.2];
                let currentYTop = 24.5;
                for (let row = 0; row < pieces.length; row++) {
                    let pHeight = pieces[row];
                    let centerY = currentYTop - (pHeight / 2);
                    p.push({ name: `Ceramica_${col}_${row}`, type: 'box', size: [w, pHeight, 2.5], pos: [currentX, centerY, zCeramica], explodedPos: [currentX, centerY, zExploded], color: 0xffffff });
                    currentYTop -= (pHeight + gapY);
                }
            }
            return p;
        })(),
        measures: [
            { text: '380 mm', start: [-19, -26, 0], end: [19, -26, 0] },
            { text: '490 mm', start: [-21, -24.5, 0], end: [-21, 24.5, 0] },
            { text: '40 mm', start: [21, 24.5, -1.5], end: [21, 24.5, 2.5] }
        ]
    },
    'DES-KBWPKLT-1342': {
        id: 'DES-KBWPKLT-1342_REV.0', type: 'Placa Espessa', dimsStr: '68 x 190 x 390 mm', screwStr: '2x Prisioneiros M16x50',
        parts: (function() {
            const p = [
                { name: 'Base_Aço', type: 'box', size: [39, 19, 1.8], pos: [0, 0, -0.9], explodedPos: [0, 0, -15], color: 0x475569 },
                { name: 'Parafuso_1', type: 'cylinder', radius: 0.8, height: 6, pos: [-10, 0, -2], explodedPos: [-10, 0, -20], color: 0x111111 },
                { name: 'Parafuso_2', type: 'cylinder', radius: 0.8, height: 6, pos: [10, 0, -2], explodedPos: [10, 0, -20], color: 0x111111 }
            ];
            const gap = 0.25; const w1 = 4.4; const w2 = 4.91; const h = 4.4; const zCeramica = 2.5; const zExploded = 15;
            for (let row = 0; row < 4; row++) {
                const centerY = 6.975 - (row * (h + gap));
                let currentX = -19.5 + 0.005;
                for (let col = 0; col < 8; col++) {
                    let isW1 = (row % 2 === 0) ? (col % 2 === 0) : (col % 2 !== 0);
                    let width = isW1 ? w1 : w2;
                    let centerX = currentX + (width / 2);
                    p.push({ name: `Ceramica_${row}_${col}`, type: 'box', size: [width, h, 5.0], pos: [centerX, centerY, zCeramica], explodedPos: [centerX, centerY, zExploded], color: 0xffffff });
                    currentX += width + gap;
                }
            }
            return p;
        })(),
        measures: [
            { text: '390 mm', start: [-19.5, -11, 0], end: [19.5, -11, 0] },
            { text: '190 mm', start: [-21, -9.5, 0], end: [-21, 9.5, 0] },
            { text: '68 mm', start: [21, 9.5, -1.8], end: [21, 9.5, 5] }
        ]
    },
    'DES-KBWPKLT-1507': {
        id: 'DES-KBWPKLT-1507_REV.2', type: 'Placa Padrão com Amarração', dimsStr: '35 x 190 x 390 mm', screwStr: '2x Prisioneiros M20x50',
        parts: [
            { name: 'Base_Aço', type: 'box', size: [39, 19, 1], pos: [0, 0, -0.5], explodedPos: [0, 0, -15], color: 0x475569 },
            { name: 'Borda_Esq', type: 'box', size: [0.3, 19, 3.5], pos: [-19.35, 0, 0.75], explodedPos: [-19.35, 0, -13.75], color: 0x475569 },
            { name: 'Borda_Dir', type: 'box', size: [0.3, 19, 3.5], pos: [19.35, 0, 0.75], explodedPos: [19.35, 0, -13.75], color: 0x475569 },
            { name: 'Borda_Sup', type: 'box', size: [38.4, 0.3, 3.5], pos: [0, 9.35, 0.75], explodedPos: [0, 9.35, -13.75], color: 0x475569 },
            { name: 'Borda_Inf', type: 'box', size: [38.4, 0.3, 3.5], pos: [0, -9.35, 0.75], explodedPos: [0, -9.35, -13.75], color: 0x475569 },
            { name: 'Parafuso_1', type: 'cylinder', radius: 1, height: 6, pos: [-10, -0.8, -2], explodedPos: [-10, -0.8, -20], color: 0x111111 },
            { name: 'Parafuso_2', type: 'cylinder', radius: 1, height: 6, pos: [10, -0.8, -2], explodedPos: [10, -0.8, -20], color: 0x111111 },
            { name: 'Ceramica_1_1_Esq', type: 'box', size: [15, 10, 2.5], pos: [-11.7, 4.2, 1.25], explodedPos: [-11.7, 4.2, 15], color: 0xffffff },
            { name: 'Ceramica_1_1_Meio', type: 'box', size: [15, 10, 2.5], pos: [3.3, 4.2, 1.25], explodedPos: [3.3, 4.2, 15], color: 0xffffff },
            { name: 'Ceramica_1_2_Dir', type: 'box', size: [8.4, 10, 2.5], pos: [15.0, 4.2, 1.25], explodedPos: [15.0, 4.2, 15], color: 0xffffff },
            { name: 'Ceramica_1_4_Esq', type: 'box', size: [8.4, 8.4, 2.5], pos: [-15.0, -5.0, 1.25], explodedPos: [-15.0, -5.0, 15], color: 0xffffff },
            { name: 'Ceramica_1_3_Meio', type: 'box', size: [15, 8.4, 2.5], pos: [-3.3, -5.0, 1.25], explodedPos: [-3.3, -5.0, 15], color: 0xffffff },
            { name: 'Ceramica_1_3_Dir', type: 'box', size: [15, 8.4, 2.5], pos: [11.7, -5.0, 1.25], explodedPos: [11.7, -5.0, 15], color: 0xffffff }
        ],
        measures: [
            { text: '390 mm', start: [-19.5, -11, 0], end: [19.5, -11, 0] },
            { text: '190 mm', start: [-21, -9.5, 0], end: [-21, 9.5, 0] },
            { text: '35 mm', start: [21, 9.5, -0.5], end: [21, 9.5, 2.5] }
        ]
    },
    'KBWPKLT-1520': {
        id: 'KBWPKLT-1520-KLC-VER.3', type: 'Placa com ABA e Amarração', dimsStr: '35 x 190 x 390 mm', screwStr: '2x Prisioneiros M16x50',
        parts: [
            { name: 'Base_Aço', type: 'box', size: [39, 19, 1], pos: [0, 0, -0.5], explodedPos: [0, 0, -15], color: 0x475569 },
            { name: 'Borda_Esq', type: 'box', size: [0.3, 19, 3.5], pos: [-19.35, 0, 0.75], explodedPos: [-19.35, 0, -13.75], color: 0x475569 },
            { name: 'Borda_Dir', type: 'box', size: [0.3, 19, 3.5], pos: [19.35, 0, 0.75], explodedPos: [19.35, 0, -13.75], color: 0x475569 },
            { name: 'Borda_Sup', type: 'box', size: [38.4, 0.3, 3.5], pos: [0, 9.35, 0.75], explodedPos: [0, 9.35, -13.75], color: 0x475569 },
            { name: 'Borda_Inf', type: 'box', size: [38.4, 0.3, 3.5], pos: [0, -9.35, 0.75], explodedPos: [0, -9.35, -13.75], color: 0x475569 },
            { name: 'Parafuso_1', type: 'cylinder', radius: 0.8, height: 6, pos: [-10.0, -0.6, -2], explodedPos: [-10.0, -0.6, -20], color: 0x111111 },
            { name: 'Parafuso_2', type: 'cylinder', radius: 0.8, height: 6, pos: [10.0, 0.6, -2], explodedPos: [10.0, 0.6, -20], color: 0x111111 },
            { name: 'Ceramica_Esq_Top', type: 'box', size: [8.8, 3.8, 2.5], pos: [-15.0, 7.5, 1.25], explodedPos: [-15.0, 7.5, 15], color: 0xffffff },
            { name: 'Ceramica_Esq_Bot', type: 'box', size: [8.8, 15.0, 2.5], pos: [-15.0, -1.9, 1.25], explodedPos: [-15.0, -1.9, 15], color: 0xffffff },
            { name: 'Ceramica_Meio_Top', type: 'box', size: [15.0, 10.0, 2.5], pos: [-3.1, 4.4, 1.25], explodedPos: [-3.1, 4.4, 15], color: 0xffffff },
            { name: 'Ceramica_Meio_Bot', type: 'box', size: [15.0, 8.8, 2.5], pos: [-3.1, -5.0, 1.25], explodedPos: [-3.1, -5.0, 15], color: 0xffffff },
            { name: 'Ceramica_Dir_Top', type: 'box', size: [15.0, 8.8, 2.5], pos: [11.9, 5.0, 1.25], explodedPos: [11.9, 5.0, 15], color: 0xffffff },
            { name: 'Ceramica_Dir_Bot', type: 'box', size: [15.0, 10.0, 2.5], pos: [11.9, -4.4, 1.25], explodedPos: [11.9, -4.4, 15], color: 0xffffff }
        ],
        measures: [
            { text: '390 mm', start: [-19.5, -11, 0], end: [19.5, -11, 0] },
            { text: '190 mm', start: [-21, -9.5, 0], end: [-21, 9.5, 0] },
            { text: '35 mm', start: [21, 9.5, -0.5], end: [21, 9.5, 2.5] }
        ]
    },
    'KBWPKLT-1522': {
        id: 'KBWPKLT-1522-KLC', type: 'Placa com ABA e Amarração', dimsStr: '35 x 190 x 390 mm', screwStr: '2x Prisioneiros M20X50',
        parts: [
            { name: 'Base_Aço', type: 'box', size: [39, 19, 1], pos: [0, 0, -0.5], explodedPos: [0, 0, -15], color: 0x475569 },
            { name: 'Borda_Esq', type: 'box', size: [0.3, 19, 3.5], pos: [-19.35, 0, 0.75], explodedPos: [-19.35, 0, -13.75], color: 0x475569 },
            { name: 'Borda_Dir', type: 'box', size: [0.3, 19, 3.5], pos: [19.35, 0, 0.75], explodedPos: [19.35, 0, -13.75], color: 0x475569 },
            { name: 'Borda_Sup', type: 'box', size: [38.4, 0.3, 3.5], pos: [0, 9.35, 0.75], explodedPos: [0, 9.35, -13.75], color: 0x475569 },
            { name: 'Borda_Inf', type: 'box', size: [38.4, 0.3, 3.5], pos: [0, -9.35, 0.75], explodedPos: [0, -9.35, -13.75], color: 0x475569 },
            { name: 'Parafuso_1', type: 'cylinder', radius: 1.0, height: 6, pos: [-10.0, -0.6, -2], explodedPos: [-10.0, -0.6, -20], color: 0x111111 },
            { name: 'Parafuso_2', type: 'cylinder', radius: 1.0, height: 6, pos: [10.0, 0.6, -2], explodedPos: [10.0, 0.6, -20], color: 0x111111 },
            { name: 'Ceramica_Esq_Top', type: 'box', size: [8.8, 3.8, 2.5], pos: [-15.0, 7.5, 1.25], explodedPos: [-15.0, 7.5, 15], color: 0xffffff },
            { name: 'Ceramica_Esq_Bot', type: 'box', size: [8.8, 15.0, 2.5], pos: [-15.0, -1.9, 1.25], explodedPos: [-15.0, -1.9, 15], color: 0xffffff },
            { name: 'Ceramica_Meio_Top', type: 'box', size: [15.0, 10.0, 2.5], pos: [-3.1, 4.4, 1.25], explodedPos: [-3.1, 4.4, 15], color: 0xffffff },
            { name: 'Ceramica_Meio_Bot', type: 'box', size: [15.0, 8.8, 2.5], pos: [-3.1, -5.0, 1.25], explodedPos: [-3.1, -5.0, 15], color: 0xffffff },
            { name: 'Ceramica_Dir_Top', type: 'box', size: [15.0, 8.8, 2.5], pos: [11.9, 5.0, 1.25], explodedPos: [11.9, 5.0, 15], color: 0xffffff },
            { name: 'Ceramica_Dir_Bot', type: 'box', size: [15.0, 10.0, 2.5], pos: [11.9, -4.4, 1.25], explodedPos: [11.9, -4.4, 15], color: 0xffffff }
        ],
        measures: [
            { text: '390 mm', start: [-19.5, -11, 0], end: [19.5, -11, 0] },
            { text: '190 mm', start: [-21, -9.5, 0], end: [-21, 9.5, 0] },
            { text: '35 mm', start: [21, 9.5, -0.5], end: [21, 9.5, 2.5] }
        ]
    },
    'KBWPKLT-1525': {
        id: 'KBWPKLT-1525-KLC-VER.1', type: 'Alça e ABA', dimsStr: '68 x 190 x 390 mm', screwStr: '2x Prisioneiros M16x50',
        parts: [
            { name: 'Base_Aço', type: 'box', size: [39, 19, 1.8], pos: [0, 0, -0.9], explodedPos: [0, 0, -15], color: 0x475569 },
            { name: 'Borda_Esq', type: 'box', size: [0.1, 19, 6.8], pos: [-19.45, 0, 1.6], explodedPos: [-19.45, 0, -13.4], color: 0x475569 },
            { name: 'Borda_Dir', type: 'box', size: [0.1, 19, 6.8], pos: [19.45, 0, 1.6], explodedPos: [19.45, 0, -13.4], color: 0x475569 },
            { name: 'Borda_Sup', type: 'box', size: [38.8, 0.1, 6.8], pos: [0, 9.45, 1.6], explodedPos: [0, 9.45, -13.4], color: 0x475569 },
            { name: 'Borda_Inf', type: 'box', size: [38.8, 0.1, 6.8], pos: [0, -9.45, 1.6], explodedPos: [0, -9.45, -13.4], color: 0x475569 },
            { name: 'Alça_Esq_Top', type: 'box', size: [2.5, 3, 0.2], pos: [-20.75, 4.0, -0.5], explodedPos: [-20.75, 4.0, -15], color: 0x111111, isFabric: true },
            { name: 'Alça_Esq_Bot', type: 'box', size: [2.5, 3, 0.2], pos: [-20.75, -4.0, -0.5], explodedPos: [-20.75, -4.0, -15], color: 0x111111, isFabric: true },
            { name: 'Alça_Esq_Ext', type: 'box', size: [0.2, 8.2, 3], pos: [-21.9, 0, -0.5], explodedPos: [-21.9, 0, -15], color: 0x111111, isFabric: true },
            { name: 'Alça_Dir_Top', type: 'box', size: [2.5, 3, 0.2], pos: [20.75, 4.0, -0.5], explodedPos: [20.75, 4.0, -15], color: 0x111111, isFabric: true },
            { name: 'Alça_Dir_Bot', type: 'box', size: [2.5, 3, 0.2], pos: [20.75, -4.0, -0.5], explodedPos: [20.75, -4.0, -15], color: 0x111111, isFabric: true },
            { name: 'Alça_Dir_Ext', type: 'box', size: [0.2, 8.2, 3], pos: [21.9, 0, -0.5], explodedPos: [21.9, 0, -15], color: 0x111111, isFabric: true },
            { name: 'Parafuso_1', type: 'cylinder', radius: 0.8, height: 6, pos: [-10.0, -0.6, -2], explodedPos: [-10.0, -0.6, -20], color: 0x111111 },
            { name: 'Parafuso_2', type: 'cylinder', radius: 0.8, height: 6, pos: [10.0, -0.6, -2], explodedPos: [10.0, -0.6, -20], color: 0x111111 },
            { name: 'Ceramica_Top_Esq', type: 'box', size: [15.0, 10.0, 5.0], pos: [-11.9, 4.4, 2.5], explodedPos: [-11.9, 4.4, 15], color: 0xffffff },
            { name: 'Ceramica_Top_Meio', type: 'box', size: [15.0, 10.0, 5.0], pos: [3.1, 4.4, 2.5], explodedPos: [3.1, 4.4, 15], color: 0xffffff },
            { name: 'Ceramica_Top_Dir', type: 'box', size: [8.8, 10.0, 5.0], pos: [15.0, 4.4, 2.5], explodedPos: [15.0, 4.4, 15], color: 0xffffff },
            { name: 'Ceramica_Bot_Esq', type: 'box', size: [8.8, 8.8, 5.0], pos: [-15.0, -5.0, 2.5], explodedPos: [-15.0, -5.0, 15], color: 0xffffff },
            { name: 'Ceramica_Bot_Meio', type: 'box', size: [15.0, 8.8, 5.0], pos: [-3.1, -5.0, 2.5], explodedPos: [-3.1, -5.0, 15], color: 0xffffff },
            { name: 'Ceramica_Bot_Dir', type: 'box', size: [15.0, 8.8, 5.0], pos: [11.9, -5.0, 2.5], explodedPos: [11.9, -5.0, 15], color: 0xffffff }
        ],
        measures: [
            { text: '390 mm', start: [-19.5, -11, 0], end: [19.5, -11, 0] },
            { text: '190 mm', start: [-21, -9.5, 0], end: [-21, 9.5, 0] },
            { text: '68 mm', start: [21, 9.5, -1.8], end: [21, 9.5, 5] }
        ]
    },
    'KBWPKLT-1503': {
        id: 'KBWPKLT-1503-KLC_REV.2', type: 'Com Alça e ABA', dimsStr: '63 x 390 x 390 mm', screwStr: '4x Prisioneiros M16x50',
        parts: (function() {
            const p = [
                { name: 'Base_Aço', type: 'box', size: [39, 39, 1.3], pos: [0, 0, 0.65], explodedPos: [0, 0, -15], color: 0x475569 },
                { name: 'ABA_Esq', type: 'box', size: [0.5, 39, 6.3], pos: [-19.25, 0, 3.15], explodedPos: [-19.25, 0, -15], color: 0x475569 },
                { name: 'ABA_Dir', type: 'box', size: [0.5, 39, 6.3], pos: [19.25, 0, 3.15], explodedPos: [19.25, 0, -15], color: 0x475569 },
                { name: 'ABA_Sup', type: 'box', size: [38, 0.5, 6.3], pos: [0, 19.25, 3.15], explodedPos: [0, 19.25, -15], color: 0x475569 },
                { name: 'ABA_Inf', type: 'box', size: [38, 0.5, 6.3], pos: [0, -19.25, 3.15], explodedPos: [0, -19.25, -15], color: 0x475569 },
                { name: 'Matriz_Borracha', type: 'box', size: [38, 38, 4.5], pos: [0, 0, 3.55], explodedPos: [0, 0, -5], color: 0x111111 },
                { name: 'Alça_Esq_Top', type: 'box', size: [2.5, 3, 0.2], pos: [-20.75, 8.0, 1.0], explodedPos: [-20.75, 8.0, -14], color: 0x111111, isFabric: true },
                { name: 'Alça_Esq_Bot', type: 'box', size: [2.5, 3, 0.2], pos: [-20.75, -8.0, 1.0], explodedPos: [-20.75, -8.0, -14], color: 0x111111, isFabric: true },
                { name: 'Alça_Esq_Ext', type: 'box', size: [0.2, 16.2, 3], pos: [-21.9, 0, 1.0], explodedPos: [-21.9, 0, -14], color: 0x111111, isFabric: true },
                { name: 'Alça_Dir_Top', type: 'box', size: [2.5, 3, 0.2], pos: [20.75, 8.0, 1.0], explodedPos: [20.75, 8.0, -14], color: 0x111111, isFabric: true },
                { name: 'Alça_Dir_Bot', type: 'box', size: [2.5, 3, 0.2], pos: [20.75, -8.0, 1.0], explodedPos: [20.75, -8.0, -14], color: 0x111111, isFabric: true },
                { name: 'Alça_Dir_Ext', type: 'box', size: [0.2, 16.2, 3], pos: [21.9, 0, 1.0], explodedPos: [21.9, 0, -14], color: 0x111111, isFabric: true },
                { name: 'Parafuso_1', type: 'cylinder', radius: 0.8, height: 6, pos: [-10.0, 10.0, -2], explodedPos: [-10.0, 10.0, -20], color: 0x111111 },
                { name: 'Parafuso_2', type: 'cylinder', radius: 0.8, height: 6, pos: [10.0, 10.0, -2], explodedPos: [10.0, 10.0, -20], color: 0x111111 },
                { name: 'Parafuso_3', type: 'cylinder', radius: 0.8, height: 6, pos: [-10.0, -10.0, -2], explodedPos: [-10.0, -10.0, -20], color: 0x111111 },
                { name: 'Parafuso_4', type: 'cylinder', radius: 0.8, height: 6, pos: [10.0, -10.0, -2], explodedPos: [10.0, -10.0, -20], color: 0x111111 }
            ];
            const gridSize = 7; const w = 5.0; const h = 5.0; const gap = 0.5; const startX = -16.5; const startY = 16.5;
            for (let row = 0; row < gridSize; row++) {
                let centerY = startY - row * (h + gap);
                for (let col = 0; col < gridSize; col++) {
                    let centerX = startX + col * (w + gap);
                    p.push({ name: `Ceramica_${row}_${col}`, type: 'box', size: [w, h, 5.0], pos: [centerX, centerY, 3.8], explodedPos: [centerX, centerY, 15], color: 0xffffff });
                }
            }
            return p;
        })(),
        measures: [
            { text: '390 mm', start: [-19.5, -22, 0], end: [19.5, -22, 0] },
            { text: '390 mm', start: [-22, -19.5, 0], end: [-22, 19.5, 0] },
            { text: '63 mm', start: [22, 19.5, 0], end: [22, 19.5, 6.3] }
        ]
    },
    'KBWPKLT-1642': {
        id: 'KBWPKLT-1642-KLC', type: 'Placa Quadrada c/ ABA', dimsStr: '400 x 400 x 35 mm', screwStr: '4x Prisioneiros M20x50',
        parts: [
            { name: 'Base_Aço', type: 'box', size: [40, 40, 1], pos: [0, 0, -1.25], explodedPos: [0, 0, -15], color: 0x475569 },
            { name: 'ABA_Lateral_Esq', type: 'box', size: [0.8, 40, 3.5], pos: [-19.6, 0, 0], explodedPos: [-19.6, 0, -15], color: 0x475569 },
            { name: 'Borda_Dir', type: 'box', size: [0.8, 40, 3.5], pos: [19.6, 0, 0], explodedPos: [19.6, 0, -15], color: 0x475569 },
            { name: 'Borda_Sup', type: 'box', size: [38.4, 0.8, 3.5], pos: [0, 19.6, 0], explodedPos: [0, 19.6, -15], color: 0x475569 },
            { name: 'Borda_Inf', type: 'box', size: [38.4, 0.8, 3.5], pos: [0, -19.6, 0], explodedPos: [0, -19.6, -15], color: 0x475569 },
            { name: 'Parafuso_1', type: 'cylinder', radius: 1, height: 6, pos: [-10, 10, -2], explodedPos: [-10, 10, -20], color: 0x111111 },
            { name: 'Parafuso_2', type: 'cylinder', radius: 1, height: 6, pos: [10, 10, -2], explodedPos: [10, 10, -20], color: 0x111111 },
            { name: 'Parafuso_3', type: 'cylinder', radius: 1, height: 6, pos: [-10, -10, -2], explodedPos: [-10, -10, -20], color: 0x111111 },
            { name: 'Parafuso_4', type: 'cylinder', radius: 1, height: 6, pos: [10, -10, -2], explodedPos: [10, -10, -20], color: 0x111111 },
            { name: 'Ceramica_1_1', type: 'box', size: [15, 10, 2.5], pos: [-11.7, 14.2, 0.5], explodedPos: [-11.7, 14.2, 15], color: 0xffffff },
            { name: 'Ceramica_1_2', type: 'box', size: [15, 10, 2.5], pos: [3.3, 14.2, 0.5], explodedPos: [3.3, 14.2, 15], color: 0xffffff },
            { name: 'Ceramica_1_3', type: 'box', size: [8.4, 10, 2.5], pos: [15.0, 14.2, 0.5], explodedPos: [15.0, 14.2, 15], color: 0xffffff },
            { name: 'Ceramica_2_1', type: 'box', size: [8.4, 10, 2.5], pos: [-15.0, 4.2, 0.5], explodedPos: [-15.0, 4.2, 15], color: 0xffffff },
            { name: 'Ceramica_2_2', type: 'box', size: [15, 10, 2.5], pos: [-3.3, 4.2, 0.5], explodedPos: [-3.3, 4.2, 15], color: 0xffffff },
            { name: 'Ceramica_2_3', type: 'box', size: [15, 10, 2.5], pos: [11.7, 4.2, 0.5], explodedPos: [11.7, 4.2, 15], color: 0xffffff },
            { name: 'Ceramica_3_1', type: 'box', size: [15, 10, 2.5], pos: [-11.7, -5.8, 0.5], explodedPos: [-11.7, -5.8, 15], color: 0xffffff },
            { name: 'Ceramica_3_2', type: 'box', size: [15, 10, 2.5], pos: [3.3, -5.8, 0.5], explodedPos: [3.3, -5.8, 15], color: 0xffffff },
            { name: 'Ceramica_3_3', type: 'box', size: [8.4, 10, 2.5], pos: [15.0, -5.8, 0.5], explodedPos: [15.0, -5.8, 15], color: 0xffffff },
            { name: 'Ceramica_4_1', type: 'box', size: [8.4, 8.4, 2.5], pos: [-15.0, -15.0, 0.5], explodedPos: [-15.0, -15.0, 15], color: 0xffffff },
            { name: 'Ceramica_4_2', type: 'box', size: [15, 8.4, 2.5], pos: [-3.3, -15.0, 0.5], explodedPos: [-3.3, -15.0, 15], color: 0xffffff },
            { name: 'Ceramica_4_3', type: 'box', size: [15, 8.4, 2.5], pos: [11.7, -15.0, 0.5], explodedPos: [11.7, -15.0, 15], color: 0xffffff }
        ],
        measures: [
            { text: '400 mm', start: [-20, -22, 0], end: [20, -22, 0] },
            { text: '400 mm', start: [-22, -20, 0], end: [-22, 20, 0] },
            { text: '35 mm', start: [22, 20, -1.25], end: [22, 20, 2.25] }
        ]
    },
    'DES-KBWPKLT-1801': {
        id: 'DES-KBWPKLT-1801_REV.1', type: 'Placa com Alça e Amarração', dimsStr: '68 x 190 x 390 mm', screwStr: '2x Prisioneiros M16X50',
        parts: (function() {
            const p = [
                { name: 'Base_Aço', type: 'box', size: [39, 19, 1.8], pos: [0, 0, -0.9], explodedPos: [0, 0, -15], color: 0x475569 },
                { name: 'Borda_Esq', type: 'box', size: [0.2, 19, 6.8], pos: [-19.4, 0, 1.6], explodedPos: [-19.4, 0, -15], color: 0x475569 },
                { name: 'Borda_Dir', type: 'box', size: [0.2, 19, 6.8], pos: [19.4, 0, 1.6], explodedPos: [19.4, 0, -15], color: 0x475569 },
                { name: 'Borda_Sup', type: 'box', size: [38.6, 0.2, 6.8], pos: [0, 9.4, 1.6], explodedPos: [0, 9.4, -15], color: 0x475569 },
                { name: 'Borda_Inf', type: 'box', size: [38.6, 0.2, 6.8], pos: [0, -9.4, 1.6], explodedPos: [0, -9.4, -15], color: 0x475569 },
                { name: 'Alça_Esq_Top', type: 'box', size: [2.5, 3, 0.2], pos: [-20.65, 4.0, -0.5], explodedPos: [-20.65, 4.0, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Esq_Bot', type: 'box', size: [2.5, 3, 0.2], pos: [-20.65, -4.0, -0.5], explodedPos: [-20.65, -4.0, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Esq_Ext', type: 'box', size: [0.2, 8.2, 3], pos: [-21.8, 0, -0.5], explodedPos: [-21.8, 0, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Dir_Top', type: 'box', size: [2.5, 3, 0.2], pos: [20.75, 4.0, -0.5], explodedPos: [20.75, 4.0, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Dir_Bot', type: 'box', size: [2.5, 3, 0.2], pos: [20.75, -4.0, -0.5], explodedPos: [20.75, -4.0, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Dir_Ext', type: 'box', size: [0.2, 8.2, 3], pos: [21.8, 0, -0.5], explodedPos: [21.8, 0, -15], color: 0x111111, isFabric: true },
                { name: 'Parafuso_1', type: 'cylinder', radius: 0.8, height: 6, pos: [-10, 0, -2], explodedPos: [-10, 0, -20], color: 0x111111 },
                { name: 'Parafuso_2', type: 'cylinder', radius: 0.8, height: 6, pos: [10, 0, -2], explodedPos: [10, 0, -20], color: 0x111111 }
            ];
            const gap = 0.2; const w = 4.65; const hFull = 4.8; const hSmall = 3.8; const zCeramica = 2.5; const zExploded = 15;
            let startX = -19.3 + (w/2);
            for (let col = 0; col < 8; col++) {
                const centerX = startX + col * (w + gap);
                let currentY = 9.4;
                const isEven = (col % 2 === 0);
                const heights = isEven ? [hFull, hFull, hFull, hSmall] : [hSmall, hFull, hFull, hFull];
                const labels = isEven ? ['1.1', '1.1', '1.1', '1.1.2'] : ['1.1.2', '1.1', '1.1', '1.1'];
                for (let row = 0; row < 4; row++) {
                    let h = heights[row];
                    let centerY = currentY - (h / 2);
                    p.push({ name: `Ceramica_${col}_${row}_${labels[row]}`, type: 'box', size: [w, h, 5.0], pos: [centerX, centerY, zCeramica], explodedPos: [centerX, centerY, zExploded], color: 0xffffff });
                    currentY -= (h + gap);
                }
            }
            return p;
        })(),
        measures: [
            { text: '390 mm', start: [-19.5, -11, 0], end: [19.5, -11, 0] },
            { text: '190 mm', start: [-21, -9.5, 0], end: [-21, 9.5, 0] },
            { text: '68 mm', start: [21, 9.5, -1.8], end: [21, 9.5, 5] }
        ]
    },
    'WPHSKRX-1845': {
        id: 'WPHSKRX-1845-KLC', type: 'Magnética (4 Fileiras c/ Alças)', dimsStr: '67 x 190 x 390 mm', screwStr: '8x Ímanes Quadrados Embutidos',
        parts: (function() {
            const p = [
                { name: 'Base_Fundo', type: 'box', size: [19, 39, 1.3], pos: [0, 0, -0.65], explodedPos: [0, 0, -15], color: 0x111111 },
                { name: 'ABA_Esq', type: 'box', size: [0.2, 39, 6.7], pos: [-9.4, 0, 2.05], explodedPos: [-9.4, 0, -13.35], color: 0x475569 },
                { name: 'ABA_Dir', type: 'box', size: [0.2, 39, 6.7], pos: [9.4, 0, 2.05], explodedPos: [9.4, 0, -13.35], color: 0x475569 },
                { name: 'ABA_Sup', type: 'box', size: [18.6, 0.2, 6.7], pos: [0, 19.4, 2.05], explodedPos: [0, 19.4, -13.35], color: 0x475569 },
                { name: 'ABA_Inf', type: 'box', size: [18.6, 0.2, 6.7], pos: [0, -19.4, 2.05], explodedPos: [0, -19.4, -13.35], color: 0x475569 },
                { name: 'Alça_Sup_Esq', type: 'box', size: [0.2, 2.5, 3], pos: [-4.0, 20.65, 0], explodedPos: [-4.0, 20.65, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Sup_Dir', type: 'box', size: [0.2, 2.5, 3], pos: [4.0, 20.65, 0], explodedPos: [4.0, 20.65, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Sup_Ext', type: 'box', size: [8.2, 0.2, 3], pos: [0, 21.8, 0], explodedPos: [0, 21.8, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Inf_Esq', type: 'box', size: [0.2, 2.5, 3], pos: [-4.0, -20.65, 0], explodedPos: [-4.0, -20.65, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Inf_Dir', type: 'box', size: [0.2, 2.5, 3], pos: [4.0, -20.65, 0], explodedPos: [4.0, -20.65, -15], color: 0x111111, isFabric: true },
                { name: 'Alça_Inf_Ext', type: 'box', size: [8.2, 0.2, 3], pos: [0, -21.8, 0], explodedPos: [0, -21.8, -15], color: 0x111111, isFabric: true }
            ];
            const magX = [-4.5, 4.5]; const magY = [13.5, 4.5, -4.5, -13.5];
            magX.forEach((mx, i) => { magY.forEach((my, j) => { p.push({ name: `Ima_${i}_${j}`, type: 'box', size: [4, 4, 1.5], pos: [mx, my, -0.65], explodedPos: [mx, my, -25], color: 0x64748b }); }); });
            const cols = 4; const rows = 8; const gap = 0.2;
            const w = (18.6 - (cols - 1) * gap) / cols;
            const h = (38.6 - (rows - 1) * gap) / rows;
            let startX = -9.3 + (w / 2); let startY = 19.3 - (h / 2);
            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    let label = '1.2';
                    if (c === 0 && r === 7) label = '1.3'; if (c === 1 && r === 0) label = '1.3';
                    if (c === 2 && r === 7) label = '1.3'; if (c === 3 && r === 0) label = '1.3';
                    p.push({ name: `Ceramica_${c}_${r}_${label}`, type: 'box', size: [w, h, 5.4], pos: [startX + c*(w+gap), startY - r*(h+gap), 2.7], explodedPos: [startX + c*(w+gap), startY - r*(h+gap), 15], color: 0xffffff });
                }
            }
            return p;
        })(),
        measures: [
            { text: '190 mm', start: [-9.5, -22, 0], end: [9.5, -22, 0] },
            { text: '390 mm', start: [-11, -19.5, 0], end: [-11, 19.5, 0] },
            { text: '67 mm', start: [11, 19.5, -1.3], end: [11, 19.5, 5.4] }
        ]
    },
    'WPHSKRX-0473': {
        id: 'WPHSKRX-0473-KLC REV.3', type: 'Vertical com Borracha', dimsStr: '35 x 380 x 490 mm', screwStr: '3x Prisioneiros M16X50',
        parts: (function() {
            const p = [
                { name: 'Base_Aço', type: 'box', size: [38, 49, 0.5], pos: [0, 0, 0.25], explodedPos: [0, 0, -15], color: 0x475569 },
                { name: 'Borda_Esq', type: 'box', size: [0.3, 49, 3.5], pos: [-18.85, 0, 1.75], explodedPos: [-18.85, 0, -13.25], color: 0x475569 },
                { name: 'Borda_Dir', type: 'box', size: [0.3, 49, 3.5], pos: [18.85, 0, 1.75], explodedPos: [18.85, 0, -13.25], color: 0x475569 },
                { name: 'Borda_Sup', type: 'box', size: [37.4, 0.3, 3.5], pos: [0, 24.35, 1.75], explodedPos: [0, 24.35, -13.25], color: 0x475569 },
                { name: 'Borda_Inf', type: 'box', size: [37.4, 0.3, 3.5], pos: [0, -24.35, 1.75], explodedPos: [0, -24.35, -13.25], color: 0x475569 },
                { name: 'Matriz_Borracha', type: 'box', size: [37.4, 48.4, 2.5], pos: [0, 0, 1.75], explodedPos: [0, 0, -5], color: 0x111111 },
                { name: 'Parafuso_1', type: 'cylinder', radius: 0.8, height: 6, pos: [0, 20, -1.5], explodedPos: [0, 20, -20], color: 0x111111 },
                { name: 'Parafuso_2', type: 'cylinder', radius: 0.8, height: 6, pos: [0, 0, -1.5], explodedPos: [0, 0, -20], color: 0x111111 },
                { name: 'Parafuso_3', type: 'cylinder', radius: 0.8, height: 6, pos: [0, -20, -1.5], explodedPos: [0, -20, -20], color: 0x111111 }
            ];
            const w = 4.4; const gapX = 0.31; const gapY = 0.22; const zCeramica = 2.25; const zExploded = 15; let startX = -16.485;
            for (let col = 0; col < 8; col++) {
                let currentX = startX + col * (w + gapX);
                let isSmallTop = (col % 2 === 0);
                let pieces = isSmallTop ? [2.2, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4] : [4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 2.2];
                let currentYTop = 24.2;
                for (let row = 0; row < pieces.length; row++) {
                    let pHeight = pieces[row];
                    let centerY = currentYTop - (pHeight / 2);
                    p.push({ name: `Ceramica_${col}_${row}`, type: 'box', size: [w, pHeight, 2.5], pos: [currentX, centerY, zCeramica], explodedPos: [currentX, centerY, zExploded], color: 0xffffff });
                    currentYTop -= (pHeight + gapY);
                }
            }
            return p;
        })(),
        measures: [
            { text: '380 mm', start: [-19, -26, 0], end: [19, -26, 0] },
            { text: '490 mm', start: [-21, -24.5, 0], end: [-21, 24.5, 0] },
            { text: '35 mm', start: [21, 9.5, 0], end: [21, 9.5, 3.5] }
        ]
    }
};


// ==========================================
// SCENE MANAGER 3D - COMPLETO (com rubberActive, setPanMode, exportImage, resetCameraPos)
// ==========================================
class SceneManager {
    constructor(canvasContainer, labelsContainer) {
        this.container = canvasContainer;
        this.labelsContainer = labelsContainer;
        this.animationParts = [];
        this.htmlLabels = [];
        this.isWireframe = false;
        this.isAssembled = true;
        this.resettingCamera = false;
        this.initScene();
        this.bindEvents();
        this.animate = this.animate.bind(this);
        this.reqId = requestAnimationFrame(this.animate);
    }
    initScene() {
        const rect = this.container.getBoundingClientRect();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 2000);
        this.camera.position.set(60, 60, 120);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
        this.renderer.setSize(rect.width, rect.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0xf8fafc);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 400;
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
        dirLight.shadow.camera.left = -100; dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100; dirLight.shadow.camera.bottom = -100;
        dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);
        const backLight = new THREE.DirectionalLight(0xa5f3fc, 0.6);
        backLight.position.set(-50, 20, -50);
        this.scene.add(backLight);
        const gridHelper = new THREE.GridHelper(150, 30, 0xbae6fd, 0xe2e8f0);
        gridHelper.position.y = -30; gridHelper.material.opacity = 0.5; gridHelper.material.transparent = true;
        this.scene.add(gridHelper);
        const floorGeo = new THREE.PlaneGeometry(500, 500);
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.15 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2; floor.position.y = -50; floor.receiveShadow = true;
        this.scene.add(floor);
        this.modelGroup = new THREE.Group();
        this.rubberGroup = new THREE.Group();
        this.cadLinesGroup = new THREE.Group();
        this.scene.add(this.modelGroup);
        this.scene.add(this.cadLinesGroup);
    }
    bindEvents() {
        this.resizeHandler = () => {
            if (!this.container) return;
            const rect = this.container.getBoundingClientRect();
            this.camera.aspect = rect.width / rect.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(rect.width, rect.height);
        };
        window.addEventListener('resize', this.resizeHandler);
    }
    clearScene() {
        while (this.modelGroup.children.length > 0) this.modelGroup.remove(this.modelGroup.children[0]);
        while (this.cadLinesGroup.children.length > 0) this.cadLinesGroup.remove(this.cadLinesGroup.children[0]);
        this.rubberGroup = new THREE.Group();
        this.animationParts = [];
        this.labelsContainer.innerHTML = '';
        this.htmlLabels = [];
    }
    loadProject(project, rubberActive) {
        this.clearScene();
        this.rubberGroup.visible = !!rubberActive;
        const materialNormal = new THREE.MeshStandardMaterial({ color: 0x8892b0, metalness: 0.7, roughness: 0.4, wireframe: this.isWireframe });
        const materialScrew = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2, wireframe: this.isWireframe });
        const materialFabric = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.0, roughness: 0.9, wireframe: this.isWireframe });
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        let validPartsCount = 0;
        project.parts.forEach(part => {
            let geometry; let mat = materialNormal;
            const isCeramic = part.name.includes('Ceramica') || part.color === 0xffffff || part.name.startsWith('C_');
            const isRubber = part.name.includes('Borracha') || part.name.includes('Base_Fundo') || part.name.includes('Ima');
            if (part.type === 'box') {
                geometry = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
                if (part.color) {
                    let mMetalness = 0.7, mRoughness = 0.4, mEmissive = 0x000000;
                    if (isCeramic) { mMetalness = 0.0; mRoughness = 1.0; mEmissive = 0x555555; }
                    else if (isRubber) { mMetalness = 0.05; mRoughness = 0.95; }
                    mat = new THREE.MeshStandardMaterial({ color: part.color, emissive: mEmissive, metalness: mMetalness, roughness: mRoughness, wireframe: this.isWireframe });
                }
                if (part.isFabric) mat = materialFabric;
            } else if (part.type === 'cylinder' || part.type === 'cylinder_hole') {
                geometry = new THREE.CylinderGeometry(part.radius, part.radius, part.height, 32);
                mat = (part.type === 'cylinder_hole') ? new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: this.isWireframe }) : materialScrew;
            }
            if (geometry) {
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.castShadow = true; mesh.receiveShadow = true;
                if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
                if (part.type === 'cylinder') mesh.rotation.x = Math.PI / 2;
                mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
                const isContinuousSteel = part.name.includes('Base_Aço') || part.name.includes('Borda') || part.name.includes('ABA');
                if (part.type === 'box' && !isContinuousSteel) {
                    let edgeColor = 0x0284c7, edgeOpacity = 0.5;
                    if (isCeramic) { edgeColor = 0x000000; edgeOpacity = 1.0; }
                    else if (isRubber) { edgeColor = 0x000000; edgeOpacity = 0.1; }
                    const edgesGeom = new THREE.EdgesGeometry(geometry);
                    const edgesMat = new THREE.LineBasicMaterial({ color: edgeColor, linewidth: 2, opacity: edgeOpacity, transparent: edgeOpacity < 1.0 });
                    if (!isRubber || edgeOpacity > 0) mesh.add(new THREE.LineSegments(edgesGeom, edgesMat));
                }
                this.animationParts.push({ mesh, assembledPos: new THREE.Vector3(part.pos[0], part.pos[1], part.pos[2]), explodedPos: new THREE.Vector3(part.explodedPos[0], part.explodedPos[1], part.explodedPos[2]) });
                if (part.type === 'box' && !part.name.includes('Alça') && !part.name.includes('Ima_') && !part.name.includes('Base') && !part.name.includes('Matriz')) {
                    minX = Math.min(minX, part.pos[0] - part.size[0]/2); maxX = Math.max(maxX, part.pos[0] + part.size[0]/2);
                    minY = Math.min(minY, part.pos[1] - part.size[1]/2); maxY = Math.max(maxY, part.pos[1] + part.size[1]/2);
                    minZ = Math.min(minZ, part.pos[2] - part.size[2]/2); maxZ = Math.max(maxZ, part.pos[2] + part.size[2]/2);
                    validPartsCount++;
                }
                this.modelGroup.add(mesh);
            }
        });
        const hasABA = project.parts.some(p => p.name.includes('Borda') || p.name.includes('ABA'));
        if (validPartsCount > 0 && !hasABA) {
            const thick = 0.3; const w = maxX - minX, h = maxY - minY, d = maxZ - minZ;
            const cx = (maxX + minX) / 2, cy = (maxY + minY) / 2, cz = (maxZ + minZ) / 2;
            const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });
            const createTape = (sx, sy, sz, px, py, pz, dx, dy) => {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), rubberMat);
                mesh.position.set(px, py, pz);
                this.rubberGroup.add(mesh);
                this.animationParts.push({ mesh, assembledPos: new THREE.Vector3(px, py, pz), explodedPos: new THREE.Vector3(px + dx, py + dy, pz - 10) });
            };
            createTape(thick, h + thick*2, d, cx - w/2 - thick/2, cy, cz, -5, 0);
            createTape(thick, h + thick*2, d, cx + w/2 + thick/2, cy, cz, 5, 0);
            createTape(w, thick, d, cx, cy + h/2 + thick/2, cz, 0, 5);
            createTape(w, thick, d, cx, cy - h/2 - thick/2, cz, 0, -5);
            this.modelGroup.add(this.rubberGroup);
        }
        const materialLine = new THREE.LineBasicMaterial({ color: 0x0284c7, opacity: 0.8, transparent: true });
        project.measures.forEach(m => {
            const points = [new THREE.Vector3(m.start[0], m.start[1], m.start[2]), new THREE.Vector3(m.end[0], m.end[1], m.end[2])];
            this.cadLinesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), materialLine));
            const pos3D = new THREE.Vector3((m.start[0] + m.end[0])/2, (m.start[1] + m.end[1])/2, (m.start[2] + m.end[2])/2);
            const div = document.createElement('div');
            div.style.position = 'absolute'; div.style.color = '#0284c7'; div.style.fontSize = '0.75rem';
            div.style.fontWeight = '600'; div.style.fontFamily = 'monospace';
            div.style.background = 'rgba(255, 255, 255, 0.85)'; div.style.padding = '2px 6px';
            div.style.border = '1px solid rgba(2, 132, 199, 0.3)'; div.style.borderRadius = '4px';
            div.style.pointerEvents = 'none'; div.style.transform = 'translate(-50%, -50%)';
            div.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
            div.innerHTML = m.text;
            this.labelsContainer.appendChild(div);
            this.htmlLabels.push({ element: div, pos3D });
        });
    }
    setWireframe(wireframe) {
        this.isWireframe = wireframe;
        this.modelGroup.traverse((child) => {
            if (child.isMesh && child.material.color && child.material.color.getHex() !== 0x000000) child.material.wireframe = wireframe;
        });
    }
    setRubberActive(active) { this.rubberGroup.visible = active; }
    setAssembled(assembled) { this.isAssembled = assembled; this.cadLinesGroup.visible = assembled; this.labelsContainer.style.opacity = assembled ? '1' : '0'; }
    setAutoRotate(active) { this.controls.autoRotate = active; this.controls.autoRotateSpeed = 2.0; }
    setPanMode(active) {
        if (active) { this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN; this.controls.touches.ONE = THREE.TOUCH.PAN; }
        else { this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE; this.controls.touches.ONE = THREE.TOUCH.ROTATE; }
    }
    resetCameraPos() { this.resettingCamera = true; }
    exportImage() {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
    }
    animate() {
        this.reqId = requestAnimationFrame(this.animate);
        this.controls.update();
        const lerpFactor = 0.08;
        this.animationParts.forEach(part => {
            const target = this.isAssembled ? part.assembledPos : part.explodedPos;
            part.mesh.position.lerp(target, lerpFactor);
        });
        if (this.resettingCamera) {
            this.camera.position.lerp(new THREE.Vector3(60, 60, 120), lerpFactor);
            this.controls.target.lerp(new THREE.Vector3(0, 0, 0), lerpFactor);
            if (this.camera.position.distanceTo(new THREE.Vector3(60, 60, 120)) < 0.5) this.resettingCamera = false;
        }
        if (this.container && this.labelsContainer) {
            const rect = this.container.getBoundingClientRect();
            const tempV = new THREE.Vector3();
            this.htmlLabels.forEach(label => {
                tempV.copy(label.pos3D).project(this.camera);
                if (tempV.z > 1) label.element.style.display = 'none';
                else {
                    label.element.style.display = 'block';
                    label.element.style.left = `${(tempV.x * 0.5 + 0.5) * rect.width}px`;
                    label.element.style.top = `${(-(tempV.y * 0.5) + 0.5) * rect.height}px`;
                }
            });
        }
        this.renderer.render(this.scene, this.camera);
    }
    dispose() {
        cancelAnimationFrame(this.reqId);
        window.removeEventListener('resize', this.resizeHandler);
        this.renderer.dispose();
        if (this.container) this.container.innerHTML = '';
        if (this.labelsContainer) this.labelsContainer.innerHTML = '';
    }
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    if (!username || !password) { setError("Preencha o nome de usuário e a senha."); setLoading(false); return; }
    let firstName = username.trim().split(' ')[0].toLowerCase();
    if (firstName.includes('@')) firstName = firstName.split('@')[0];
    try {
      const mapRes = await fetch(`${SUPABASE_REST_URL}portal_login_map?usuario=eq.${firstName}&select=email`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const mapData = await mapRes.json();
      const email = mapData?.[0]?.email;
      if (!mapRes.ok || !email) throw new Error('Usuário não encontrado.');
      const res = await fetch(`${SUPABASE_AUTH_URL}token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) throw new Error('Falha na autenticação.');
      localStorage.setItem('kbn_supabase_token', data.access_token);
      localStorage.setItem('kbn_supabase_refresh_token', data.refresh_token);
      localStorage.setItem('kbn_auth', 'true');
      localStorage.setItem('kbn_user', firstName);
      onLogin();
    } catch (err) { setError("Nome de usuário ou senha incorretos."); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
      <div className="w-full max-w-md z-10">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 lg:p-12 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10 text-center">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Portal Comercial</h1>
            <p className="text-blue-600 text-sm font-bold uppercase mt-2 tracking-widest">Kalenborn do Brasil</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1 text-left">Nome do Vendedor</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-slate-700 shadow-inner" placeholder="Ex: Hygor" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1 text-left">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold text-slate-700 shadow-inner" placeholder="••••••••" />
            </div>
            {error && <div className="bg-rose-50 text-rose-600 text-xs font-bold p-4 rounded-xl flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-600/30 transition-all uppercase tracking-widest text-xs flex justify-center items-center gap-2 touch-manipulation cursor-pointer">
              {loading ? <RefreshCw className="animate-spin" size={16} /> : "Acessar Sistema"}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-8">© 2026 Kalenborn do Brasil • DB Supabase</p>
      </div>
    </div>
  );
}

// ==========================================
// APP PRINCIPAL
// ==========================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('kbn_auth') === 'true');
  const [activeTab, setActiveTab] = useState('catalog');
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth >= 1024);
  const [selectedTechSheetId, setSelectedTechSheetId] = useState('');

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [observations, setObservations] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [fispList, setFispList] = useState([]);
  const [customLogo, setCustomLogo] = useState(defaultLogoBase64);
  const [openAIApiKey, setOpenAIApiKey] = useState(localStorage.getItem('kalenborn_openai_key') || '');

  const [currentProposal, setCurrentProposal] = useState(getEmptyProposal());

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 4000); };

  const refreshData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabaseRequestPaged('clients?select=*&order=company.asc'),
        supabaseRequest('products?select=*&order=name.asc'),
        supabaseRequest('observations?select=*'),
        supabaseRequest('proposals?select=*&order=created_at.desc'),
        supabaseRequest('settings?select=*'),
        supabaseRequest('estoque?select=*,products(id,name,codkalenborn,um,price,codvale)&order=updated_at.desc'),
        supabaseRequest('fisp?select=*&order=created_at.desc'),
      ]);
      if(results[0].status === 'fulfilled') setClients(results[0].value || []);
      if(results[1].status === 'fulfilled') setProducts(results[1].value || []);
      if(results[2].status === 'fulfilled') setObservations(results[2].value || []);
      if(results[3].status === 'fulfilled') {
          const normProposals = (results[3].value || []).map(prop => ({
            ...prop, numeroUnico: prop.numerounico || prop.numeroUnico, clientId: prop.clientid || prop.clientId
          }));
          setProposals(normProposals);
      }
      if(results[4].status === 'fulfilled' && results[4].value?.length > 0) {
         const logoSetting = results[4].value.find(s => s.id === 'logo');
         if (logoSetting?.value) setCustomLogo(logoSetting.value);
         const apiKeySetting = results[4].value.find(s => s.id === 'openai_key');
         if (apiKeySetting?.value) setOpenAIApiKey(apiKeySetting.value);
      }
      if(results[5].status === 'fulfilled') setEstoque(results[5].value || []);
      if(results[6].status === 'fulfilled') setFispList(results[6].value || []);
    } catch (e) { showToast("Erro ao carregar dados."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const handleExpired = () => { setIsAuthenticated(false); showToast("Sessão expirada. Faça login novamente."); };
    window.addEventListener('kbn-session-expired', handleExpired);
    return () => window.removeEventListener('kbn-session-expired', handleExpired);
  }, []);

  useEffect(() => { 
    if (!document.getElementById('html2pdf-script')) {
      const script = document.createElement('script'); script.id = 'html2pdf-script'; script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'; document.head.appendChild(script);
    }
    const handleResize = () => { if (window.innerWidth < 1024) setIsSidebarExpanded(false); else setIsSidebarExpanded(true); };
    window.addEventListener('resize', handleResize);
    if (isAuthenticated) refreshData(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated]);

  const saveProposalToDB = async (proposalToSave) => {
    if (!proposalToSave.clientId) return showToast("⚠️ Selecione o cliente no Elaborador.");
    try {
      const isNew = !proposalToSave.id;
      const propId = isNew ? `prop_${Date.now()}` : proposalToSave.id;
      let numeroUnico = proposalToSave.numeroUnico;
      if (isNew) numeroUnico = `PROP-${new Date().getFullYear()}-${(proposals.length + 1).toString().padStart(4, '0')}`;
      const currentUser = localStorage.getItem('kbn_user') || 'Desconhecido';
      const finalConfig = { ...proposalToSave.config, vendedor: proposalToSave.config?.vendedor || currentUser };
      const { total } = calculateProposalTotals(proposalToSave.items, finalConfig.desconto);
      const dbPayload = { 
        id: propId, numerounico: numeroUnico, status: proposalToSave.status || 'Pendente', 
        clientid: proposalToSave.clientId, items: proposalToSave.items, config: finalConfig, total: total 
      };
      if (proposalToSave.attachment_url) dbPayload.attachment_url = proposalToSave.attachment_url;
      const exists = proposals.some(p => p.id === propId);
      if (exists) await supabaseRequest('proposals', 'PATCH', dbPayload);
      else await supabaseRequest('proposals', 'POST', dbPayload, true);
      setCurrentProposal({...proposalToSave, id: propId, numeroUnico, total, config: finalConfig});
      showToast(`Proposta salva!`); refreshData(); setActiveTab('management');
    } catch (e) { showToast("Erro ao gravar. Verifique se a sua tabela Supabase tem RLS."); }
  };

  const deleteProposal = async (id) => {
    try {
      await supabaseRequest(`proposals?id=eq.${id}`, 'DELETE');
      setProposals(prev => prev.filter(p => p.id !== id));
      showToast("Proposta excluída com sucesso!");
    } catch (error) { showToast("Erro ao excluir proposta."); }
  };

  if (!isAuthenticated) return <LoginScreen onLogin={() => { setIsAuthenticated(true); localStorage.setItem('kbn_auth', 'true'); }} />;

  return (
    <div className="flex h-screen w-full bg-[#F1F5F9] relative font-sans overflow-hidden text-slate-800">
      <aside className={`bg-[#0F172A] text-slate-300 flex flex-col absolute lg:relative h-full shadow-2xl z-[70] transition-all duration-300 border-r border-white/5 ${isSidebarExpanded ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-20 lg:translate-x-0'}`}>
        <div className="h-16 lg:h-20 flex items-center justify-between lg:justify-start px-4 lg:px-6 bg-[#0B1120] border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
          <div className="flex items-center"><div className="bg-blue-600 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center shrink-0"><FileSignature size={20} className="text-white" /></div><span className={`font-black text-white text-sm ml-3 uppercase tracking-widest overflow-hidden transition-all duration-300 ${!isSidebarExpanded && 'lg:hidden'}`}>Portal KBN</span></div>
          <button onClick={(e) => { e.stopPropagation(); setIsSidebarExpanded(false); }} className="lg:hidden text-white p-2"><X size={20}/></button>
        </div>
        <nav className="flex-1 py-8 space-y-3 px-3 overflow-y-auto custom-scrollbar">
          <NavItem icon={Search} label="Catálogo" active={activeTab === 'catalog'} onClick={() => { setActiveTab('catalog'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <NavItem icon={PenTool} label="Elaborador" active={activeTab === 'builder'} onClick={() => { setActiveTab('builder'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} badge={currentProposal.items.length > 0 ? currentProposal.items.length : null} collapsed={!isSidebarExpanded} />
          <NavItem icon={PieChart} label="Gestão CRM" active={activeTab === 'management'} onClick={() => { setActiveTab('management'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <NavItem icon={Package} label="Estoque" active={activeTab === 'estoque'} onClick={() => { setActiveTab('estoque'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <NavItem icon={ShieldAlert} label="FISP" active={activeTab === 'fisp'} onClick={() => { setActiveTab('fisp'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <NavItem icon={Box} label="Bandejas 3D" active={activeTab === 'simulator'} onClick={() => { setActiveTab('simulator'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <NavItem icon={Layers} label="Ficha Técnica" active={activeTab === 'technicalSheet'} onClick={() => { setActiveTab('technicalSheet'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
        </nav>
        <div className="p-4 border-t border-white/5 bg-[#0B1120]/50 space-y-3 shrink-0">
          <NavItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <button onClick={() => {
            const token = localStorage.getItem('kbn_supabase_token');
            if (token) fetch(`${SUPABASE_AUTH_URL}logout`, { method: 'POST', headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } }).catch(() => {});
            setIsAuthenticated(false);
            localStorage.removeItem('kbn_auth'); localStorage.removeItem('kbn_user');
            localStorage.removeItem('kbn_supabase_token'); localStorage.removeItem('kbn_supabase_refresh_token');
          }} className="w-full flex items-center p-3.5 rounded-xl transition-all text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 group cursor-pointer"><LogOut size={20} className="lg:w-6" /><span className={`font-bold text-xs uppercase tracking-widest transition-all duration-300 ml-3 ${!isSidebarExpanded && 'lg:hidden'}`}>Sair</span></button>
        </div>
      </aside>

      {isSidebarExpanded && window.innerWidth < 1024 && <div className="fixed inset-0 bg-slate-900/60 z-50 lg:hidden backdrop-blur-sm pointer-events-auto" onClick={() => setIsSidebarExpanded(false)}></div>}

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 shadow-sm z-30 justify-between">
           <div className="font-black text-slate-800 uppercase text-sm flex items-center gap-2"><FileSignature size={18} className="text-blue-600"/> Kalenborn</div>
           <button onClick={() => setIsSidebarExpanded(true)} className="text-slate-600 p-2 rounded-lg cursor-pointer"><Menu size={24} /></button>
        </div>
        {loading ? (
           <div className="flex h-full items-center justify-center flex-col gap-4 bg-slate-50 z-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div><p className="text-slate-400 font-bold text-xs uppercase">Carregando Banco...</p></div>
        ) : (
          <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
            {activeTab === 'catalog' && <CatalogView clients={clients} products={products} currentProposal={currentProposal} setCurrentProposal={setCurrentProposal} apiKey={openAIApiKey} showToast={showToast} setActiveTab={setActiveTab} logo={customLogo} />}
            {activeTab === 'builder' && <BuilderView clients={clients} products={products} observations={observations} currentProposal={currentProposal} setCurrentProposal={setCurrentProposal} logo={customLogo} showToast={showToast} saveProposalToDB={saveProposalToDB} isSidebarExpanded={isSidebarExpanded} setActiveTab={setActiveTab} setSelectedTechSheetId={setSelectedTechSheetId} />}
            {activeTab === 'management' && <ManagementView proposals={proposals} clients={clients} updateStatus={async (id, s) => { await supabaseRequest('proposals', 'PATCH', {id, status: s}); refreshData();}} loadProposalForEditing={(p) => {setCurrentProposal(p); setActiveTab('builder');}} deleteProposal={deleteProposal} />}
            {activeTab === 'estoque' && <EstoqueView products={products} estoque={estoque} showToast={showToast} refreshData={refreshData} />}
            {activeTab === 'fisp' && <FispView fispList={fispList} showToast={showToast} refreshData={refreshData} />}
            {activeTab === 'simulator' && <SimulatorView showToast={showToast} refreshData={refreshData} products={products} />}
            {activeTab === 'technicalSheet' && <TechnicalSheetView products={products} customLogo={customLogo} showToast={showToast} initialSelectedId={selectedTechSheetId} />}
            {activeTab === 'settings' && <SettingsView showToast={showToast} setCustomLogo={setCustomLogo} currentLogo={customLogo} refreshData={refreshData} openAIApiKey={openAIApiKey} setOpenAIApiKey={setOpenAIApiKey} />}
          </div>
        )}
      </main>
      {toastMessage && <div className="fixed top-6 right-6 z-[100] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 font-bold text-sm animate-in fade-in slide-in-from-top-4 flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> {toastMessage}</div>}
      <style>{`.custom-scrollbar::-webkit-scrollbar{width:6px;height:6px}.custom-scrollbar::-webkit-scrollbar-track{background:transparent}.custom-scrollbar::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}.custom-scrollbar::-webkit-scrollbar-thumb:hover{background:#94a3b8}.pdf-preview-wrapper{transform-origin:top center;transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);margin:0 auto}.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}.touch-manipulation{touch-action:manipulation}`}</style>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge, collapsed }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center p-3.5 rounded-xl transition-all group relative overflow-hidden cursor-pointer touch-manipulation ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'hover:bg-white/5 text-slate-400'}`} title={label}>
      <div className="w-8 flex items-center justify-center shrink-0 relative"><Icon size={20} className={`${active ? 'text-white' : 'group-hover:text-blue-400 transition-colors'}`} />{badge && collapsed && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>}</div>
      <span className={`font-bold text-xs uppercase tracking-widest text-left whitespace-nowrap transition-all duration-300 ${!collapsed ? 'opacity-100 ml-3' : 'opacity-0 w-0 hidden'}`}>{label}</span>
      {badge && !collapsed && <span className="absolute right-3 bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md">{badge}</span>}
    </button>
  );
}


// ==========================================
// ABA ESTOQUE
// ==========================================
function EstoqueView({ products, estoque, showToast, refreshData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'add_estoque' | 'add_produto' | 'edit_price' | 'edit_estoque'
  const [selectedItem, setSelectedItem] = useState(null);
  const [loadingSave, setLoadingSave] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('estoque'); // 'estoque' | 'produtos'

  // Form: novo item de estoque
  const [estoqueForm, setEstoqueForm] = useState({ product_id: '', quantidade: '', localizacao: '', lote: '', data_entrada: new Date().toISOString().split('T')[0], observacao: '' });

  // Form: novo produto
  const emptyProduct = { id: '', codkalenborn: '', name: '', um: 'KG', price: '', ncm: '', icms: '18%', ipi: '0', piscofins: '9.25', codorigem: '0', entrega: '', codvale: '', category: '', descricao_original: '', caracteristica: '', imagem_url: '', garantia: '', subtitulo: '', propriedades_subtitulo: '', composicao_quimica: [], propriedades_material: [], camadas_construcao: [], aplicacao_recomendada: [], instrucoes_montagem: [], observacoes: [] };
  const [productForm, setProductForm] = useState(emptyProduct);

  // Form: editar preço
  const [priceForm, setPriceForm] = useState({ id: '', price: '' });

  const filteredEstoque = useMemo(() => {
    if (!searchTerm) return estoque;
    const lower = searchTerm.toLowerCase();
    return estoque.filter(e => {
      const p = e.products;
      return (p?.name?.toLowerCase().includes(lower)) ||
             (p?.codkalenborn?.toLowerCase().includes(lower)) ||
             (p?.codvale && String(p.codvale).toLowerCase().includes(lower)) ||
             (e.localizacao?.toLowerCase().includes(lower)) ||
             (e.lote?.toLowerCase().includes(lower));
    });
  }, [estoque, searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p =>
      (p.name?.toLowerCase().includes(lower)) ||
      (p.codkalenborn?.toLowerCase().includes(lower)) ||
      (p.codvale && String(p.codvale).toLowerCase().includes(lower)) ||
      (String(p.id).toLowerCase().includes(lower))
    );
  }, [products, searchTerm]);

  const handleSaveEstoque = async () => {
    if (!estoqueForm.product_id) return showToast("⚠️ Selecione um produto.");
    if (!estoqueForm.quantidade) return showToast("⚠️ Informe a quantidade.");
    setLoadingSave(true);
    try {
      if (selectedItem) {
        await supabaseRequest(`estoque?id=eq.${selectedItem.id}`, 'PATCH', { ...estoqueForm, updated_at: new Date().toISOString() });
        showToast("Estoque atualizado!");
      } else {
        const payload = { ...estoqueForm, id: `est_${Date.now()}` };
        await supabaseRequest('estoque', 'POST', payload, true);
        showToast("Item registrado no estoque!");
      }
      setModalMode(null); setSelectedItem(null);
      setEstoqueForm({ product_id: '', quantidade: '', localizacao: '', lote: '', data_entrada: new Date().toISOString().split('T')[0], observacao: '' });
      refreshData();
    } catch(e) { showToast("Erro ao salvar: " + e.message); }
    finally { setLoadingSave(false); }
  };

  const handleSaveProduct = async () => {
    if (!productForm.id) return showToast("⚠️ Código KBN é obrigatório.");
    if (!productForm.name && !productForm.codkalenborn) return showToast("⚠️ Preencha o nome/descrição.");
    setLoadingSave(true);
    try {
      await supabaseRequest('products', 'POST', { ...productForm, price: parseFloat(productForm.price) || 0 }, true);
      showToast("✅ Produto cadastrado com sucesso!");
      setModalMode(null);
      setProductForm(emptyProduct);
      refreshData();
    } catch(e) { showToast("Erro ao cadastrar produto: " + e.message); }
    finally { setLoadingSave(false); }
  };

  const handleSavePrice = async () => {
    if (!priceForm.price) return showToast("⚠️ Informe o novo preço.");
    setLoadingSave(true);
    try {
      await supabaseRequest(`products?id=eq.${priceForm.id}`, 'PATCH', { price: parseFloat(priceForm.price), updated_at: new Date().toISOString() });
      showToast("✅ Preço atualizado!");
      setModalMode(null);
      refreshData();
    } catch(e) { showToast("Erro ao atualizar preço: " + e.message); }
    finally { setLoadingSave(false); }
  };

  const handleDeleteEstoque = async (id) => {
    if (!window.confirm("Remover este registro do estoque?")) return;
    try {
      await supabaseRequest(`estoque?id=eq.${id}`, 'DELETE');
      showToast("Registro removido.");
      refreshData();
    } catch(e) { showToast("Erro ao remover."); }
  };

  const totalItensEmEstoque = estoque.reduce((acc, e) => acc + (parseFloat(e.quantidade) || 0), 0);
  const totalProdutos = products.length;
  const produtosComEstoque = new Set(estoque.map(e => e.product_id)).size;

  const fieldClass = "w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block";

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3"><Package size={24} className="text-emerald-600" /> Gestão de Estoque</h1>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Controle de disponibilidade e cadastro de produtos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setModalMode('add_produto'); setProductForm(emptyProduct); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer touch-manipulation"><Plus size={16}/> Novo Produto</button>
            <button onClick={() => { setModalMode('add_estoque'); setSelectedItem(null); setEstoqueForm({ product_id: '', quantidade: '', localizacao: '', lote: '', data_entrada: new Date().toISOString().split('T')[0], observacao: '' }); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer touch-manipulation"><Archive size={16}/> Registrar Estoque</button>
          </div>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 shrink-0">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-slate-800">{totalProdutos}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Produtos Cadastrados</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-emerald-600">{produtosComEstoque}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Com Estoque</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
          <div className="text-2xl font-black text-blue-600">{formatNum(totalItensEmEstoque)}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Qtd. Total</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-6 shrink-0">
        <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm">
          <button onClick={() => setActiveSubTab('estoque')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all ${activeSubTab === 'estoque' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span className="flex items-center gap-2"><Archive size={14}/> Itens em Estoque</span>
          </button>
          <button onClick={() => setActiveSubTab('produtos')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-all ${activeSubTab === 'produtos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span className="flex items-center gap-2"><Package size={14}/> Todos os Produtos</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input type="text" placeholder="Buscar por nome, código, lote..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-blue-500 outline-none shadow-sm" />
        </div>
      </div>

      {/* Tabela Estoque */}
      {activeSubTab === 'estoque' && (
        <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="p-4">Código KBN</th>
                  <th className="p-4">Cód. Vale</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4 text-center">Qtd.</th>
                  <th className="p-4">UN</th>
                  <th className="p-4">Localização</th>
                  <th className="p-4">Lote</th>
                  <th className="p-4">Data Entrada</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEstoque.length === 0 && (
                  <tr><td colSpan="9" className="p-10 text-center text-slate-400 font-bold text-sm">Nenhum item em estoque registrado.</td></tr>
                )}
                {filteredEstoque.map(item => {
                  const prod = item.products || {};
                  const qtd = parseFloat(item.quantidade) || 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black font-mono text-xs text-blue-700">{prod.id || '—'}</td>
                      <td className="p-4 font-bold text-xs text-sky-600">{prod.codvale || '—'}</td>
                      <td className="p-4 font-medium text-sm text-slate-700 max-w-[200px]"><div className="truncate">{prod.codkalenborn || prod.name || '—'}</div></td>
                      <td className="p-4 text-center">
                        <span className={`font-black text-lg ${qtd <= 0 ? 'text-rose-500' : qtd <= 10 ? 'text-amber-500' : 'text-emerald-600'}`}>{formatNum(qtd)}</span>
                      </td>
                      <td className="p-4 text-xs font-bold text-slate-500">{prod.um || '—'}</td>
                      <td className="p-4 text-xs text-slate-600">{item.localizacao || '—'}</td>
                      <td className="p-4 text-xs font-mono text-slate-600">{item.lote || '—'}</td>
                      <td className="p-4 text-xs text-slate-500">{item.data_entrada || '—'}</td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => {
                            setSelectedItem(item);
                            setEstoqueForm({ product_id: item.product_id, quantidade: item.quantidade, localizacao: item.localizacao || '', lote: item.lote || '', data_entrada: item.data_entrada || '', observacao: item.observacao || '' });
                            setModalMode('add_estoque');
                          }} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center justify-center" title="Editar"><Edit size={14}/></button>
                          <button onClick={() => handleDeleteEstoque(item.id)} className="w-8 h-8 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all cursor-pointer flex items-center justify-center" title="Remover"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela Produtos */}
      {activeSubTab === 'produtos' && (
        <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  <th className="p-4">Cód KBN</th>
                  <th className="p-4">Cód Vale</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4">UN</th>
                  <th className="p-4">NCM</th>
                  <th className="p-4">ICMS</th>
                  <th className="p-4">IPI</th>
                  <th className="p-4 text-right">Preço Líquido</th>
                  <th className="p-4 text-center">Em Estoque</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProducts.length === 0 && (
                  <tr><td colSpan="10" className="p-10 text-center text-slate-400 font-bold text-sm">Nenhum produto encontrado.</td></tr>
                )}
                {filteredProducts.map(prod => {
                  const estoqueItem = estoque.find(e => e.product_id === prod.id);
                  const qtdEstoque = estoqueItem ? parseFloat(estoqueItem.quantidade) : null;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-black font-mono text-xs text-blue-700">{prod.id}</td>
                      <td className="p-4 font-bold text-xs text-sky-600">{prod.codvale || '—'}</td>
                      <td className="p-4 font-medium text-sm text-slate-700 max-w-[220px]"><div className="line-clamp-2">{prod.codkalenborn || prod.name}</div></td>
                      <td className="p-4 text-xs font-bold text-slate-500">{prod.um}</td>
                      <td className="p-4 text-xs font-mono text-slate-500">{prod.ncm}</td>
                      <td className="p-4 text-xs font-bold text-orange-600">{prod.icms}</td>
                      <td className="p-4 text-xs font-bold text-slate-500">{prod.ipi}%</td>
                      <td className="p-4 text-right font-black text-emerald-600 font-mono">R$ {formatNum(prod.price)}</td>
                      <td className="p-4 text-center">
                        {qtdEstoque !== null ? (
                          <span className={`font-black text-sm ${qtdEstoque <= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{formatNum(qtdEstoque)} {prod.um}</span>
                        ) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase">Sem Registro</span>
                        )}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-1.5">
                        <button onClick={() => { setPriceForm({ id: prod.id, price: prod.price || '' }); setModalMode('edit_price'); }} className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all cursor-pointer flex items-center justify-center" title="Alterar Preço"><DollarSign size={14}/></button>
                        <button onClick={() => { setProductForm({ ...emptyProduct, ...prod, composicao_quimica: Array.isArray(prod.composicao_quimica) ? prod.composicao_quimica : [], propriedades_material: Array.isArray(prod.propriedades_material) ? prod.propriedades_material : [], camadas_construcao: Array.isArray(prod.camadas_construcao) ? prod.camadas_construcao : [], aplicacao_recomendada: Array.isArray(prod.aplicacao_recomendada) ? prod.aplicacao_recomendada : [], instrucoes_montagem: Array.isArray(prod.instrucoes_montagem) ? prod.instrucoes_montagem : [], observacoes: Array.isArray(prod.observacoes) ? prod.observacoes : [] }); setModalMode('add_produto'); }} className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center justify-center" title="Editar Produto / Ficha Técnica"><Edit size={14}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR / EDITAR ESTOQUE */}
      {modalMode === 'add_estoque' && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2"><Archive size={18}/> {selectedItem ? 'Editar Registro de Estoque' : 'Registrar Item no Estoque'}</h3>
              <button onClick={() => { setModalMode(null); setSelectedItem(null); }} className="text-emerald-200 hover:text-white cursor-pointer"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className={labelClass}>Produto *</label>
                <select value={estoqueForm.product_id} onChange={e => setEstoqueForm(f => ({...f, product_id: e.target.value}))} className={fieldClass}>
                  <option value="">Selecione o produto...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.codkalenborn || p.name} — KBN: {p.id}{p.codvale ? ` | Vale: ${p.codvale}` : ''}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Quantidade *</label>
                  <input type="number" step="0.01" value={estoqueForm.quantidade} onChange={e => setEstoqueForm(f => ({...f, quantidade: e.target.value}))} placeholder="0" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Data de Entrada</label>
                  <input type="date" value={estoqueForm.data_entrada} onChange={e => setEstoqueForm(f => ({...f, data_entrada: e.target.value}))} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Localização / Galpão</label>
                  <input type="text" value={estoqueForm.localizacao} onChange={e => setEstoqueForm(f => ({...f, localizacao: e.target.value}))} placeholder="Ex: Galpão A - Prateleira 3" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Lote / NF</label>
                  <input type="text" value={estoqueForm.lote} onChange={e => setEstoqueForm(f => ({...f, lote: e.target.value}))} placeholder="Ex: LOTE-2024-001" className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Observação</label>
                <textarea rows="2" value={estoqueForm.observacao} onChange={e => setEstoqueForm(f => ({...f, observacao: e.target.value}))} placeholder="Observações adicionais..." className={`${fieldClass} resize-none`} />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-3">
              <button onClick={() => { setModalMode(null); setSelectedItem(null); }} className="flex-1 py-3 font-bold text-slate-600 bg-white border rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">Cancelar</button>
              <button onClick={handleSaveEstoque} disabled={loadingSave} className="flex-1 py-3 font-black bg-emerald-600 text-white rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                {loadingSave ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle size={16}/>} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRAR NOVO PRODUTO */}
      {modalMode === 'add_produto' && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2"><Plus size={18}/> Cadastrar Novo Produto</h3>
              <button onClick={() => setModalMode(null)} className="text-blue-200 hover:text-white cursor-pointer"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 font-medium">
                Preencha os campos abaixo. Os marcados com * são obrigatórios. O <strong>Código KBN</strong> é o identificador único do produto.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Código KBN (ID) *</label>
                  <input type="text" value={productForm.id} onChange={e => setProductForm(f => ({...f, id: e.target.value}))} placeholder="Ex: 3083" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Código Vale / Part Number</label>
                  <input type="text" value={productForm.codvale} onChange={e => setProductForm(f => ({...f, codvale: e.target.value}))} placeholder="Ex: 123456" className={fieldClass} />
                </div>
              </div>

              <div>
                <label className={labelClass}>Código Kalenborn / Nome Comercial *</label>
                <input type="text" value={productForm.codkalenborn} onChange={e => setProductForm(f => ({...f, codkalenborn: e.target.value}))} placeholder="Ex: BANDEJA KALIMPACT 390X190X35MM" className={fieldClass} />
              </div>

              <div>
                <label className={labelClass}>Nome Interno</label>
                <input type="text" value={productForm.name} onChange={e => setProductForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Bandeja cerâmica standard" className={fieldClass} />
              </div>

              <div>
                <label className={labelClass}>Descrição Original (para PDF)</label>
                <textarea rows="2" value={productForm.descricao_original} onChange={e => setProductForm(f => ({...f, descricao_original: e.target.value}))} className={`${fieldClass} resize-none`} />
              </div>

              <div>
                <label className={labelClass}>Característica Técnica (para Ficha Técnica)</label>
                <textarea rows="2" value={productForm.caracteristica} onChange={e => setProductForm(f => ({...f, caracteristica: e.target.value}))} className={`${fieldClass} resize-none`} />
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <label className={labelClass}>Imagem / Render 3D (Ficha Técnica)</label>
                <div className="flex items-center gap-4">
                  {productForm.imagem_url ? (
                    <img src={productForm.imagem_url} alt="preview" className="w-20 h-20 object-contain rounded-lg border bg-white" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-300"><Box size={24}/></div>
                  )}
                  <label className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-lg py-2.5 text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-all">
                    <Upload size={14}/> {productForm.imagem_url ? 'Trocar imagem' : 'Enviar imagem/render'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const fileName = `produtos/${productForm.id || 'novo'}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                          const url = await supabaseUpload('portal-files', fileName, file);
                          setProductForm(f => ({ ...f, imagem_url: url }));
                          showToast('✅ Imagem enviada!');
                        } catch (err) { showToast('Erro ao enviar imagem.'); }
                      }}
                    />
                  </label>
                  {productForm.imagem_url && (
                    <button type="button" onClick={() => setProductForm(f => ({...f, imagem_url: ''}))} className="w-9 h-9 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white flex items-center justify-center cursor-pointer" title="Remover imagem"><Trash2 size={14}/></button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>Subtítulo (Ficha Técnica)</label>
                <input type="text" value={productForm.subtitulo} onChange={e => setProductForm(f => ({...f, subtitulo: e.target.value}))} placeholder="Ex: Chapa antidesgaste cerâmica / Ceramic wear plate" className={fieldClass} />
              </div>

              <div>
                <label className={labelClass}>Garantia</label>
                <input type="text" value={productForm.garantia} onChange={e => setProductForm(f => ({...f, garantia: e.target.value}))} placeholder="Ex: 12 meses a partir da emissão da NF" className={fieldClass} />
              </div>

              <TableEditor
                label="Construção em Camadas (Ficha Técnica)"
                rows={productForm.camadas_construcao}
                columns={[{ key: 'espessura', placeholder: 'Ex: 50,00 mm' }, { key: 'material', placeholder: 'Ex: Cerâmica alta alumina 95% Kalocer' }]}
                onChange={rows => setProductForm(f => ({ ...f, camadas_construcao: rows }))}
              />

              <TableEditor
                label="Propriedades do Produto — Página 2 (Característica / Unidade / Valor)"
                rows={productForm.composicao_quimica}
                columns={[{ key: 'item', placeholder: 'Ex: Densidade' }, { key: 'unidade', placeholder: 'g/cm³' }, { key: 'valor', placeholder: '≥ 3,6' }]}
                onChange={rows => setProductForm(f => ({ ...f, composicao_quimica: rows }))}
              />
              <div>
                <label className={labelClass}>Subtítulo da tabela de propriedades (Página 2)</label>
                <input type="text" value={productForm.propriedades_subtitulo} onChange={e => setProductForm(f => ({...f, propriedades_subtitulo: e.target.value}))} placeholder="Ex: Cerâmica de alta alumina Kalocer 95%" className={fieldClass} />
              </div>

              <TableEditor
                label="Propriedades do Material — Página 1 (opcional, sobrepõe a extração automática)"
                rows={productForm.propriedades_material}
                columns={[{ key: 'caracteristica', placeholder: 'Ex: Densidade' }, { key: 'unidade', placeholder: 'g/cm³' }, { key: 'valor', placeholder: '3,6 - 3,65' }]}
                onChange={rows => setProductForm(f => ({ ...f, propriedades_material: rows }))}
              />

              <ListEditor
                label="Aplicação Recomendada (Página 2)"
                items={productForm.aplicacao_recomendada}
                placeholder={"Revestimento de chutes, calhas e caixas de transferência...\nPontos de queda com material granulado e abrasivo..."}
                onChange={items => setProductForm(f => ({ ...f, aplicacao_recomendada: items }))}
              />

              <ListEditor
                label="Instruções de Montagem (Página 2)"
                items={productForm.instrucoes_montagem}
                placeholder={"Limpar a superfície do equipamento...\nConferir a posição dos furos..."}
                onChange={items => setProductForm(f => ({ ...f, instrucoes_montagem: items }))}
              />

              <ListEditor
                label="Observações (Página 2)"
                items={productForm.observacoes}
                placeholder={"A temperatura máxima é limitada pela borracha...\nNão soldar, cortar ou furar a chapa..."}
                onChange={items => setProductForm(f => ({ ...f, observacoes: items }))}
              />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>UM *</label>
                  <select value={productForm.um} onChange={e => setProductForm(f => ({...f, um: e.target.value}))} className={fieldClass}>
                    <option value="KG">KG</option>
                    <option value="UN">UN</option>
                    <option value="PC">PC</option>
                    <option value="M">M</option>
                    <option value="M2">M2</option>
                    <option value="LT">LT</option>
                    <option value="CX">CX</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Preço Líquido (R$)</label>
                  <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm(f => ({...f, price: e.target.value}))} placeholder="0.00" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Categoria</label>
                  <input type="text" value={productForm.category} onChange={e => setProductForm(f => ({...f, category: e.target.value}))} placeholder="Ex: Bandeja" className={fieldClass} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>NCM</label>
                  <input type="text" value={productForm.ncm} onChange={e => setProductForm(f => ({...f, ncm: e.target.value}))} placeholder="0000.00.00" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>ICMS (%)</label>
                  <select value={productForm.icms} onChange={e => setProductForm(f => ({...f, icms: e.target.value}))} className={fieldClass}>
                    <option value="4%">4%</option>
                    <option value="7%">7%</option>
                    <option value="12%">12%</option>
                    <option value="18%">18%</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>IPI (%)</label>
                  <input type="text" value={productForm.ipi} onChange={e => setProductForm(f => ({...f, ipi: e.target.value}))} placeholder="0" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Cód. Origem</label>
                  <select value={productForm.codorigem} onChange={e => setProductForm(f => ({...f, codorigem: e.target.value}))} className={fieldClass}>
                    <option value="0">0 - Nacional</option>
                    <option value="1">1 - Importado</option>
                    <option value="2">2 - Importado</option>
                    <option value="3">3 - Nacional/Import.</option>
                    <option value="8">8 - Nacional/Import.</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Prazo de Entrega</label>
                  <input type="text" value={productForm.entrega} onChange={e => setProductForm(f => ({...f, entrega: e.target.value}))} placeholder="Ex: 30 dias" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>PIS/COFINS (%)</label>
                  <input type="text" value={productForm.piscofins} onChange={e => setProductForm(f => ({...f, piscofins: e.target.value}))} placeholder="9.25" className={fieldClass} />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-3">
              <button onClick={() => setModalMode(null)} className="flex-1 py-3 font-bold text-slate-600 bg-white border rounded-xl cursor-pointer hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSaveProduct} disabled={loadingSave} className="flex-1 py-3 font-black bg-blue-600 text-white rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-blue-700 disabled:opacity-60">
                {loadingSave ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle size={16}/>} Cadastrar Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PREÇO */}
      {modalMode === 'edit_price' && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2"><DollarSign size={18}/> Alterar Preço</h3>
              <button onClick={() => setModalMode(null)} className="text-amber-200 hover:text-white cursor-pointer"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border text-sm font-bold text-slate-700">
                Produto: <span className="text-blue-700 font-mono">{priceForm.id}</span>
                <div className="text-xs text-slate-500 mt-1 font-normal">
                  {products.find(p => p.id === priceForm.id)?.codkalenborn || ''}
                </div>
              </div>
              <div>
                <label className={labelClass}>Novo Preço Líquido (R$) *</label>
                <input type="number" step="0.01" value={priceForm.price} onChange={e => setPriceForm(f => ({...f, price: e.target.value}))} placeholder="0.00" className="w-full border-2 border-amber-300 bg-amber-50 rounded-xl px-4 py-4 text-xl font-black text-center text-amber-700 outline-none focus:border-amber-500" autoFocus />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 font-medium">
                ⚠️ Esta alteração atualiza o preço diretamente na tabela de produtos e reflete em todas as novas propostas.
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-3">
              <button onClick={() => setModalMode(null)} className="flex-1 py-3 font-bold text-slate-600 bg-white border rounded-xl cursor-pointer hover:bg-slate-100">Cancelar</button>
              <button onClick={handleSavePrice} disabled={loadingSave} className="flex-1 py-3 font-black bg-amber-500 text-white rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-600 disabled:opacity-60">
                {loadingSave ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle size={16}/>} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// ABA FISP
// ==========================================
function FispView({ fispList, showToast, refreshData }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [form, setForm] = useState({ nome: '', produto_referencia: '', arquivo: null });

  const filtered = useMemo(() => {
    if (!searchTerm) return fispList;
    const lower = searchTerm.toLowerCase();
    return fispList.filter(f =>
      f.nome?.toLowerCase().includes(lower) ||
      f.produto_referencia?.toLowerCase().includes(lower)
    );
  }, [fispList, searchTerm]);

  const handleUpload = async () => {
    if (!form.nome) return showToast("⚠️ Informe o nome da FISP.");
    if (!form.arquivo) return showToast("⚠️ Selecione o arquivo PDF.");
    setUploading(true);
    try {
      const fileName = `fisp_${Date.now()}_${form.arquivo.name.replace(/\s+/g, '_')}`;
      const url = await supabaseUpload('portal-files', `fisp/${fileName}`, form.arquivo);
      await supabaseRequest('fisp', 'POST', {
        id: `fisp_${Date.now()}`,
        nome: form.nome,
        produto_referencia: form.produto_referencia,
        arquivo_url: url,
      }, true);
      showToast("✅ FISP enviada com sucesso!");
      setModalOpen(false);
      setForm({ nome: '', produto_referencia: '', arquivo: null });
      refreshData();
    } catch(e) {
      showToast("Erro ao enviar: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await supabaseRequest(`fisp?id=eq.${id}`, 'DELETE');
      showToast("FISP removida.");
      setDeleteTarget(null);
      refreshData();
    } catch(e) { showToast("Erro ao remover."); }
  };

  const fieldClass = "w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 transition-all";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block";

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
              <ShieldAlert size={24} className="text-rose-600" /> Fichas de Informação de Segurança — FISP
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Upload e consulta de FISPs / FISPQ dos produtos</p>
          </div>
          <button onClick={() => { setModalOpen(true); setForm({ nome: '', produto_referencia: '', arquivo: null }); }} className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-md cursor-pointer touch-manipulation whitespace-nowrap">
            <Upload size={16}/> Enviar Nova FISP
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex items-center gap-4 w-fit">
          <div className="bg-rose-100 text-rose-600 p-3 rounded-xl"><ShieldAlert size={20}/></div>
          <div>
            <div className="text-2xl font-black text-slate-800">{fispList.length}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">FISPs Cadastradas</div>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="px-6 pb-3 shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
          <input type="text" placeholder="Buscar por nome ou referência..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:border-blue-500 outline-none shadow-sm" />
        </div>
      </div>

      {/* Grid de FISPs */}
      <div className="flex-1 overflow-auto custom-scrollbar px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
            <ShieldAlert size={48} className="opacity-30"/>
            <p className="font-bold text-sm">Nenhuma FISP cadastrada ainda.</p>
            <p className="text-xs">Clique em "Enviar Nova FISP" para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(fisp => (
              <div key={fisp.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-rose-300 transition-all overflow-hidden group">
                {/* Preview area */}
                <div className="h-32 bg-gradient-to-br from-rose-50 to-slate-100 flex items-center justify-center border-b border-slate-100 relative">
                  <div className="text-center">
                    <div className="w-16 h-20 bg-white border-2 border-rose-200 rounded-lg shadow-md flex items-center justify-center mx-auto mb-1 relative">
                      <FileText size={28} className="text-rose-500"/>
                      <div className="absolute bottom-1 right-1 bg-rose-500 text-white text-[8px] font-black px-1 rounded">PDF</div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-all"></div>
                </div>

                <div className="p-4">
                  <h3 className="font-black text-slate-800 text-sm line-clamp-2 mb-1">{fisp.nome}</h3>
                  {fisp.produto_referencia && (
                    <div className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded w-fit mb-3">
                      Ref: {fisp.produto_referencia}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 mb-4">
                    {fisp.created_at ? new Date(fisp.created_at).toLocaleDateString('pt-BR') : '—'}
                  </div>

                  <div className="flex gap-2">
                    <a href={fisp.arquivo_url} target="_blank" rel="noreferrer" className="flex-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white py-2 rounded-lg font-black text-[10px] uppercase text-center transition-all cursor-pointer flex items-center justify-center gap-1.5">
                      <Eye size={13}/> Abrir
                    </a>
                    <a href={fisp.arquivo_url} download className="flex-1 bg-slate-50 text-slate-700 hover:bg-slate-800 hover:text-white py-2 rounded-lg font-black text-[10px] uppercase text-center transition-all cursor-pointer flex items-center justify-center gap-1.5">
                      <Download size={13}/> Baixar
                    </a>
                    <button onClick={() => setDeleteTarget(fisp)} className="w-9 h-9 bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: UPLOAD */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-rose-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2"><Upload size={18}/> Enviar Nova FISP</h3>
              <button onClick={() => setModalOpen(false)} className="text-rose-200 hover:text-white cursor-pointer"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={labelClass}>Nome da FISP *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} placeholder="Ex: FISPQ Kalcret HC-70" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Produto de Referência (Código ou Nome)</label>
                <input type="text" value={form.produto_referencia} onChange={e => setForm(f => ({...f, produto_referencia: e.target.value}))} placeholder="Ex: 3083 ou Kalcret HC-70" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Arquivo PDF *</label>
                <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-rose-300 rounded-xl p-6 cursor-pointer hover:border-rose-500 hover:bg-rose-50 transition-all">
                  {form.arquivo ? (
                    <div className="text-center">
                      <FileText size={32} className="text-rose-500 mx-auto mb-2"/>
                      <div className="font-bold text-sm text-slate-700">{form.arquivo.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{(form.arquivo.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload size={32} className="text-slate-300 mx-auto mb-2"/>
                      <div className="font-bold text-sm text-slate-500">Clique para selecionar o PDF</div>
                      <div className="text-xs text-slate-400 mt-1">Apenas arquivos .pdf</div>
                    </div>
                  )}
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => setForm(f => ({...f, arquivo: e.target.files[0] || null}))} />
                </label>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex gap-3">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-3 font-bold text-slate-600 bg-white border rounded-xl cursor-pointer hover:bg-slate-100">Cancelar</button>
              <button onClick={handleUpload} disabled={uploading} className="flex-1 py-3 font-black bg-rose-600 text-white rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-rose-700 disabled:opacity-60">
                {uploading ? <RefreshCw className="animate-spin" size={16}/> : <Upload size={16}/>} {uploading ? 'Enviando...' : 'Enviar FISP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR DELETE */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32}/></div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Remover FISP?</h3>
              <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja remover <strong className="text-slate-800">"{deleteTarget.nome}"</strong>? O arquivo no Storage não será excluído automaticamente.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button>
                <button onClick={() => handleDelete(deleteTarget.id)} className="flex-1 py-3 font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-xl shadow-lg cursor-pointer">Remover</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// ABA CATÁLOGO (igual ao original)
// ==========================================
function CatalogView({ clients, products, currentProposal, setCurrentProposal, showToast, apiKey, setActiveTab, logo }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [addModalProd, setAddModalProd] = useState(null);
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);
  const [manualDestinoMG, setManualDestinoMG] = useState(true);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => 
      (p.codKalenborn && p.codKalenborn.toLowerCase().includes(lower)) || 
      (p.name && p.name.toLowerCase().includes(lower)) || 
      (p.id && String(p.id).toLowerCase().includes(lower)) ||
      (p.codvale && String(p.codvale).toLowerCase().includes(lower))
    );
  }, [searchTerm, products]);

  const handleAskAI = async () => {
    if (!searchTerm) return showToast("Digite algo para buscar com a IA.");
    if (!apiKey) return showToast("Configure a Chave API da OpenAI nas configurações.");
    setIsSearchingAI(true); setAiMessage(''); setAiSuggestions([]);
    try {
      const productList = products.map(p => `- KBN: "${p.id}" ${p.codvale ? `| Vale: "${p.codvale}"` : ''} | Nome: "${p.codKalenborn || p.name}" | Preço: R$${p.price}`).join('\n').substring(0, 20000); 
      const prompt = `Atuo como vendedor da Kalenborn e tenho a seguinte base de produtos (resumo):\n${productList}\n\nO cliente pediu: "${searchTerm}".\n\nBaseado na minha base, quais produtos devo oferecer? (Pode sugerir mais de um se fizer sentido).\n\nResponda OBRIGATORIAMENTE em formato JSON com a seguinte estrutura exata:\n{\n  "mensagem": "Sua resposta curta e amigável justificando a escolha das opções...",\n  "produtos_ids": ["id_do_produto_1", "id_do_produto_2"]\n}`;
      const response = await askChatGPT(prompt, apiKey, true);
      const parsed = JSON.parse(response);
      setAiMessage(parsed.mensagem || "Aqui estão algumas sugestões:");
      if (parsed.produtos_ids && Array.isArray(parsed.produtos_ids)) {
        const suggestedProds = parsed.produtos_ids.map(id => products.find(p => String(p.id) === String(id))).filter(Boolean);
        setAiSuggestions(suggestedProds);
      }
    } catch (error) { showToast("Erro ao consultar a IA."); } finally { setIsSearchingAI(false); }
  };

  const openAddModal = (prod) => { setAddModalProd(prod); setAddPrice(prod.price || 0); setAddQty(1); setManualDestinoMG(true); };
  const isSpecialProduct = addModalProd && SPECIAL_ICMS_PRODUCTS.includes(String(addModalProd.id));
  let previewGross = 0; let previewTotal = 0; let computedIcms = '18%';
  if (addModalProd) {
    const client = clients.find(c => c.id === currentProposal.clientId);
    if (currentProposal.clientId) {
      computedIcms = isSpecialProduct 
          ? getAutoIcms(client?.address, addModalProd.codOrigem || '0', addModalProd.id) 
          : (client?.icms ? (String(client.icms).includes('%') ? client.icms : `${client.icms}%`) : getAutoIcms(client?.address, addModalProd.codOrigem || '0', addModalProd.id));
    } else {
      if (isSpecialProduct) { computedIcms = manualDestinoMG ? '18%' : '4%'; }
      else { computedIcms = currentProposal.config?.icmsDestino || addModalProd.icms || '18%'; }
    }
    const pis = addModalProd.pisCofins || '9.25';
    const ipi = parseFloat(String(addModalProd.ipi || '0').replace('%', '').trim()) || 0;
    previewGross = calculateGrossPrice(addPrice, computedIcms, pis);
    previewTotal = (previewGross * addQty) * (1 + (ipi / 100));
  }

  const confirmAdd = () => {
    if (!addModalProd) return;
    setCurrentProposal(prev => {
      const nextNum = ((prev.items.length + 1) * 10).toString();
      const client = clients.find(c => c.id === prev.clientId);
      const isSpec = SPECIAL_ICMS_PRODUCTS.includes(String(addModalProd.id));
      const prodHasZeroIcms = String(addModalProd.icms || '').replace('%','').trim() === '0';
      let targetIcms = '18%';
      if (prodHasZeroIcms) { targetIcms = '0%'; }
      else if (prev.clientId) {
         const clientFixedIcms = client?.icms ? (String(client.icms).includes('%') ? client.icms : `${client.icms}%`) : null;
         targetIcms = isSpec ? getAutoIcms(client?.address, addModalProd.codOrigem || '0', addModalProd.id) : (clientFixedIcms || getAutoIcms(client?.address, addModalProd.codOrigem || '0', addModalProd.id));
      } else {
         targetIcms = isSpec ? (manualDestinoMG ? '18%' : '4%') : (prev.config?.icmsDestino || addModalProd.icms || '18%');
      }
      const newItem = { id: Date.now().toString(), productId: addModalProd.id, numeroItem: nextNum, codKalenborn: addModalProd.codKalenborn || addModalProd.name, codOrigem: addModalProd.codOrigem || '0', um: addModalProd.um || 'KG', ncm: addModalProd.ncm || 'Consultar', icms: targetIcms, ipi: addModalProd.ipi || '0', pisCofins: addModalProd.pisCofins || '9.25', price: parseFloat(addPrice) || 0, quantity: parseFloat(addQty) || 1, codvale: addModalProd.codvale || '', descricao_original: addModalProd.descricao_original || '' };
      let newRef = prev.config.referencia;
      if (!newRef) newRef = addModalProd.codKalenborn;
      return { ...prev, items: [...prev.items, newItem], config: { ...prev.config, referencia: newRef } };
    });
    showToast(`${addQty}x adicionado!`);
    setAddModalProd(null);
  };

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 lg:p-8 overflow-hidden bg-slate-50 relative font-sans">
      <header className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end shrink-0 gap-4">
        <div><img src={logo || defaultLogoBase64} alt="Logo" className="h-10 sm:h-12 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = defaultLogoBase64; }} /></div>
        <div className="relative w-full lg:w-[500px] flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Ex: Bandeja 390 ou Adesivo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskAI()} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm" /></div>
          <button onClick={handleAskAI} disabled={isSearchingAI} className="w-full sm:w-auto justify-center bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl shadow-sm font-bold flex items-center gap-2 disabled:opacity-70 cursor-pointer touch-manipulation">{isSearchingAI ? <RefreshCw className="animate-spin" size={18}/> : <Bot size={18}/>} <span className="whitespace-nowrap">Perguntar à IA</span></button>
        </div>
      </header>
      {aiMessage && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm relative shrink-0">
          <button onClick={() => { setAiMessage(''); setAiSuggestions([]); }} className="absolute top-3 right-3 text-purple-400 hover:text-purple-700 cursor-pointer"><X size={20}/></button>
          <div className="flex gap-3 items-start pr-8"><div className="bg-purple-200 p-2 rounded-full shrink-0 text-purple-700"><Bot size={20}/></div><div className="text-sm text-purple-900 leading-relaxed"><strong className="block mb-1">Sugestão:</strong> {aiMessage}</div></div>
          {aiSuggestions.length > 0 && (
            <div className="mt-2 border-t border-purple-200/60 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiSuggestions.map(p => (
                <div key={p.id} className="bg-white border border-purple-200 p-3 rounded-lg flex flex-col justify-between shadow-sm hover:border-purple-400 transition-colors">
                   <div className="mb-3"><div className="font-bold text-slate-800 text-sm mb-1">{p.codKalenborn || p.name}</div><div className="text-[10px] text-slate-500 flex flex-col gap-0.5"><span>KBN: {p.id}</span>{p.codvale && <span className="text-sky-600 font-semibold">Vale: {p.codvale}</span>}<span>UM: {p.um}</span></div></div>
                   <div className="flex items-center justify-between mt-auto"><div className="font-bold text-emerald-600">{p.price === 0 ? 'A cotar' : `R$ ${formatNum(p.price)}`}</div><button onClick={() => openAddModal(p)} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-600 hover:text-white cursor-pointer touch-manipulation flex items-center gap-1"><Plus size={14}/> Adicionar</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(aiSuggestions?.length > 0 ? aiSuggestions : filteredProducts).map(p => (
            <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col relative overflow-hidden">
              {SPECIAL_ICMS_PRODUCTS.includes(String(p.id)) && <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg shadow-sm">REGRA ICMS</div>}
              <div className="flex justify-between items-start mb-3 mt-1">
                <div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit truncate max-w-[150px]">KBN: {p.id}</span>{p.codvale && <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded w-fit truncate max-w-[150px]">Vale: {p.codvale}</span>}</div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{p.um}</span>
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">{p.codKalenborn || p.name}</h3>
              <div className="text-[10px] text-slate-500 mb-4 flex-1">NCM: {p.ncm} | ICMS: {p.icms}</div>
              <div className="flex items-end justify-between mt-auto border-t pt-3">
                <div><div className="text-[10px] text-slate-400 font-medium">Preço Base (R$)</div><div className="font-bold text-lg text-emerald-600">{p.price === 0 ? 'A cotar' : formatNum(p.price)}</div></div>
                <button onClick={() => openAddModal(p)} className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white cursor-pointer touch-manipulation shadow-sm"><Plus size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {addModalProd && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Settings size={18}/> Configurar Item</h3><button onClick={() => setAddModalProd(null)} className="text-blue-200 hover:text-white cursor-pointer"><X size={20}/></button></div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border"><div className="font-bold text-slate-800">{addModalProd.codKalenborn || addModalProd.name}</div><div className="text-[10px] text-slate-500 mt-1">NCM: {addModalProd.ncm} | KBN: {addModalProd.id} {addModalProd.codvale ? `| Vale: ${addModalProd.codvale}` : ''}</div></div>
              {isSpecialProduct && !currentProposal.clientId && (
                 <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
                    <label className="text-[10px] font-black text-orange-800 uppercase block mb-2">📍 Destino deste material especial:</label>
                    <div className="flex gap-2">
                      <button onClick={() => setManualDestinoMG(true)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${manualDestinoMG ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-100'}`}>Dentro de MG (18%)</button>
                      <button onClick={() => setManualDestinoMG(false)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${!manualDestinoMG ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-100'}`}>Fora de MG (4%)</button>
                    </div>
                 </div>
               )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-600 block mb-1">Quantidade ({addModalProd.um})</label><input type="number" step="0.01" value={addQty} onChange={(e) => setAddQty(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 outline-none text-center font-bold text-lg text-blue-700 bg-blue-50" /></div>
                <div><label className="text-xs font-bold text-slate-600 block mb-1">Preço Unit. (R$)</label><input type="number" step="0.01" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 outline-none text-center font-bold text-lg text-emerald-700 bg-emerald-50" /></div>
              </div>
              <div className="bg-slate-800 text-white rounded-lg p-3 shadow-inner border border-slate-700">
                <div className="flex justify-between items-center text-xs text-slate-300 mb-1"><span>Bruto Un. c/ Impostos:</span><span>R$ {formatNum(previewGross)}</span></div>
                <div className="text-[9px] text-slate-400 mb-2 font-bold uppercase tracking-widest">ICMS: {computedIcms} | PIS/COF: {addModalProd.pisCofins || '9.25'}% | IPI: {addModalProd.ipi || '0'}%</div>
                <div className="flex justify-between items-center font-bold text-emerald-400 text-sm border-t border-slate-600 pt-2"><span>Total (c/ IPI):</span><span>R$ {formatNum(previewTotal)}</span></div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3 border-t"><button onClick={() => setAddModalProd(null)} className="flex-1 py-2 text-slate-600 font-bold border rounded-lg bg-white cursor-pointer">Cancelar</button><button onClick={confirmAdd} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg shadow-md flex items-center justify-center gap-2 cursor-pointer"><CheckCircle size={16}/> Confirmar Item</button></div>
          </div>
        </div>
      )}
      {currentProposal?.items?.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 lg:left-auto lg:right-10 lg:w-[400px] bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-40 border border-slate-700 animate-in fade-in">
          <div className="flex items-center gap-3"><div className="bg-blue-600 text-white h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl shadow-inner shrink-0">{currentProposal.items.length}</div><div><div className="font-bold text-sm">Item(s) na Proposta</div><div className="text-[10px] text-slate-300 hidden sm:block">Avançe para gerar o PDF</div></div></div>
          <button onClick={() => setActiveTab('builder')} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-md flex items-center gap-2 border border-blue-500 whitespace-nowrap cursor-pointer touch-manipulation">Avançar</button>
        </div>
      )}
    </div>
  );
}


// ==========================================
// ABA ELABORADOR (BuilderView) - igual ao original
// ==========================================
function BuilderView({ clients, products, observations, currentProposal, setCurrentProposal, logo, showToast, saveProposalToDB, isSidebarExpanded, setActiveTab, setSelectedTechSheetId }) {
  const [clientSearchText, setClientSearchText] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [quickAddProductId, setQuickAddProductId] = useState('');
  const [mobileTab, setMobileTab] = useState('editor');
  const [isEditorVisible, setIsEditorVisible] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  let pdfScale = 0.50;
  if (windowWidth >= 1280) {
      if (!isEditorVisible && !isSidebarExpanded) pdfScale = 1.1;
      else if (!isEditorVisible) pdfScale = 0.95;
      else if (!isSidebarExpanded) pdfScale = 0.75;
      else pdfScale = 0.60;
  } else if (windowWidth >= 1024) {
      if (!isEditorVisible) pdfScale = 0.90; else pdfScale = 0.50;
  } else if (windowWidth >= 768) {
      pdfScale = mobileTab === 'preview' ? (windowWidth - 64) / 794 : 0.50;
  } else {
      pdfScale = mobileTab === 'preview' ? (windowWidth - 32) / 794 : 0.45;
  }

  const cfg = currentProposal.config;
  const items = currentProposal.items;

  useEffect(() => {
    const c = clients.find(cl => cl.id === currentProposal.clientId);
    if (c) setClientSearchText(c.company || c.nome || '');
  }, [currentProposal.clientId, clients]);

  const filteredClients = clients.filter(c => {
     const s = clientSearchText.toLowerCase().trim();
     return (c.company?.toLowerCase().includes(s)) || (c.document?.includes(s)) || (String(c.id).toLowerCase().includes(s));
  }).slice(0, 10);

  const selectedClient = clients.find(c => c.id === currentProposal.clientId);
  const { subtotalBruto, subtotalLiquido, totalIpi, total, valorDesconto } = calculateProposalTotals(items, cfg.desconto);

  const updateConfig = (f, v) => setCurrentProposal(p => ({ ...p, config: { ...p.config, [f]: v } }));
  const updateItem = (id, f, v) => setCurrentProposal(p => ({ ...p, items: p.items.map(i => i.id === id ? { ...i, [f]: v } : i) }));
  const removeItem = (id) => setCurrentProposal(p => ({ ...p, items: p.items.filter(i => i.id !== id) }));

  const handleQuickAdd = () => {
    const prod = products.find(p => String(p.id) === String(quickAddProductId));
    if (!prod) return;
    const client = clients.find(c => c.id === currentProposal.clientId);
    const isSpec = SPECIAL_ICMS_PRODUCTS.includes(String(prod.id));
    const prodZeroIcms = String(prod.icms || '').replace('%','').trim() === '0';
    let autoIcms = '18%';
    if (prodZeroIcms) { autoIcms = '0%'; }
    else if (currentProposal.clientId) {
       const clientFixedIcms = client?.icms ? (String(client.icms).includes('%') ? client.icms : `${client.icms}%`) : null;
       autoIcms = isSpec ? getAutoIcms(client?.address, prod.codOrigem || '0', prod.id) : (clientFixedIcms || getAutoIcms(client?.address, prod.codOrigem || '0', prod.id));
    } else { autoIcms = isSpec ? '18%' : (cfg.icmsDestino || '18%'); }
    const newItem = { id: Date.now().toString(), productId: prod.id, numeroItem: ((items.length + 1) * 10).toString(), codKalenborn: prod.codKalenborn || prod.name, name: prod.name, price: parseFloat(prod.price) || 0, quantity: 1, um: prod.um || 'UN', ncm: prod.ncm || 'Consultar', icms: autoIcms, ipi: prod.ipi || '0', pisCofins: prod.pisCofins || '9.25', codOrigem: prod.codOrigem || '0', codvale: prod.codvale || '', descricao_original: prod.descricao_original || '' };
    setCurrentProposal(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setQuickAddProductId('');
    showToast("Material Adicionado!");
  };

  const handleDescontoChange = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) { updateConfig('desconto', ''); return; }
    if (val > 3) { showToast("⚠️ O desconto máximo permitido é de 3%."); val = 3; }
    else if (val < 0) { val = 0; }
    updateConfig('desconto', val);
  };

  const handleGeneratePDFAndUpload = async () => {
    if (!window.html2pdf) return showToast("Aguarde a biblioteca PDF.");
    setIsGeneratingPDF(true);
    if (window.innerWidth < 1024) setMobileTab('preview');
    setTimeout(async () => {
      const scrollContainer = document.getElementById('print-scroll-container');
      if (scrollContainer) { scrollContainer.scrollLeft = 0; scrollContainer.scrollTop = 0; }
      const wrapper = document.querySelector('.pdf-preview-wrapper');
      const originalTransform = wrapper ? wrapper.style.transform : '';
      if (wrapper) { wrapper.style.transition = 'none'; wrapper.style.transform = 'none'; }
      await new Promise(resolve => setTimeout(resolve, 150));
      const element = document.getElementById('documento-pdf-real');
      if (!element) { showToast("Erro: conteúdo do PDF não encontrado."); if (wrapper) wrapper.style.transform = originalTransform; setIsGeneratingPDF(false); return; }
      const opt = { margin: 0, filename: `Proposta_Kalenborn_${currentProposal?.numeroUnico || 'Comercial'}.pdf`, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 2, dpi: 300, letterRendering: true, useCORS: true, scrollX: 0, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      try {
        const worker = window.html2pdf().set(opt).from(element);
        await worker.save();
        try {
          const pdfBlob = await worker.output('blob');
          const fileName = `Proposta_${currentProposal?.numeroUnico || 'Nova'}_${Date.now()}.pdf`;
          showToast("A guardar PDF na nuvem...");
          const publicUrl = await supabaseUpload('portal-files', `propostas/${fileName}`, pdfBlob);
          if (currentProposal?.id) {
            await supabaseRequest('proposals', 'PATCH', { id: currentProposal.id, attachment_url: publicUrl });
            setCurrentProposal(prev => ({ ...prev, attachment_url: publicUrl }));
            showToast("✅ Proposta guardada no CRM!");
          }
        } catch (err) { showToast("PDF gerado, mas falha ao enviar para a nuvem."); }
      } catch (err) { showToast("Erro ao gerar PDF."); }
      finally {
        if (wrapper) { wrapper.style.transform = originalTransform; setTimeout(() => { if (wrapper) wrapper.style.transition = 'transform 0.3s ease'; }, 50); }
        setIsGeneratingPDF(false);
      }
    }, 500);
  };

  const fieldClass = "w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-sm appearance-none touch-manipulation";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1 text-left";

  const renderPdfLayout = () => (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000000' }}>
       <header className="flex justify-between items-start mb-6" style={{ pageBreakInside: 'avoid' }}>
          <div className="w-1/2 flex flex-col"><img src={logo || defaultLogoBase64} alt="Kalenborn Logo" className="h-16 object-contain object-left mb-1" style={{ maxWidth: '220px' }} onError={(e) => { e.target.onerror = null; e.target.src = defaultLogoBase64; }} /></div>
          <div className="w-1/2 flex justify-end"><div className="text-[11px] leading-tight text-left"><div className="text-[12px] font-bold mb-1">KALENBORN DO BRASIL LTDA</div><div>Estrada Antiga BH - Pedro Leopoldo, Nº.: 1150 Galpão 03</div><div>Bairro: Fazenda Canavial Velho - Vespasiano / MG</div><div>C.E.P.: 33206-220</div><div>C.N.P.J.: 04.921.141/0001-06 &nbsp;&nbsp;&nbsp; I.E.: 0621852710097</div></div></div>
       </header>
       <div className="text-center font-bold text-[14px] uppercase my-4 py-1 border-t-2 border-b-2 border-black" style={{ pageBreakInside: 'avoid' }}>Proposta Comercial {currentProposal.numeroUnico}</div>
       <div className="text-[12px] leading-relaxed mb-6" style={{ pageBreakInside: 'avoid' }}>
          <div className="flex justify-between"><div><span className="font-bold">Projeto:</span> {cfg.projeto}</div><div><span className="font-bold">Data de Emissão:</span> {cfg.date}</div></div>
          <div className="mt-1 flex"><div className="w-full"><span className="font-bold">Razão Social:</span> {selectedClient?.company || clientSearchText}</div></div>
          <div className="flex"><div className="w-1/2 flex"><span className="font-bold mr-1">Endereço:</span> {selectedClient?.address || ''}</div><div className="w-1/2 flex items-center"><span className="font-bold whitespace-nowrap mr-1">Contato:</span><div className="flex-1 ml-1 overflow-hidden">{cfg.contato}</div></div></div>
          <div className="flex"><div className="w-1/2"><span className="font-bold">CNPJ/CPF:</span> {formatCNPJ(selectedClient?.document || selectedClient?.cnpj)}</div><div className="w-1/2"><span className="font-bold">Telefone:</span> {selectedClient?.phone || ''}</div></div>
          <div className="flex"><div className="w-1/2"><span className="font-bold">De:</span> {cfg.emissor}</div><div className="w-1/2"><span className="font-bold">Insc. Est.:</span> {selectedClient?.ie || 'Isento'}</div></div>
          <div className="mt-1"><span className="font-bold">Referência:</span> {cfg.referencia}</div>
       </div>
       <div className="mb-2">
          <table className="w-full text-left border-collapse border border-black" style={{ fontSize: '10px', tableLayout: 'fixed' }}>
            <thead><tr className="bg-gray-200 font-bold" style={{ pageBreakInside: 'avoid' }}><th className="py-1 px-1 border border-black text-center" style={{ width: '4%' }}>Item</th><th className="py-1 px-2 border border-black" style={{ width: '34%' }}>Descrição do Material</th><th className="py-1 px-2 border border-black text-center" style={{ width: '7%' }}>Cód Origem</th><th className="py-1 px-1 border border-black text-center" style={{ width: '5%' }}>Qtde</th><th className="py-1 px-1 border border-black text-center" style={{ width: '4%' }}>UN</th><th className="py-1 px-2 border border-black text-right" style={{ width: '13%' }}>Líquido Un.</th><th className="py-1 px-2 border border-black text-right" style={{ width: '13%' }}>Bruto Un.</th><th className="py-1 px-2 border border-black text-right" style={{ width: '20%' }}>Vlr. Total</th></tr></thead>
            <tbody className="text-[11px]">
              {items.length === 0 ? (<tr><td colSpan="8" className="p-4 text-center italic text-gray-500 border border-black">Nenhum item adicionado</td></tr>) : (
                items.map((item, index) => {
                  const grossPrice = calculateGrossPrice(item.price, item.icms, item.pisCofins);
                  const ipi = parseFloat(item.ipi) || 0;
                  const totalItem = (grossPrice * item.quantity) * (1 + (ipi / 100));
                  return (
                    <tr key={item.id} style={{ pageBreakInside: 'avoid' }}>
                      <td className="py-1 px-1 border-b border-r border-black text-center font-bold">{item.numeroItem || index + 1}</td>
                      <td className="py-1 px-2 border-b border-r border-black uppercase" style={{ wordBreak: 'break-word' }}><div className="font-bold">{item.codKalenborn}</div><div className="text-[9px] mt-0.5 text-gray-700">KBN: {item.productId}{item.codvale ? ` | VALE: ${item.codvale}` : ''}</div></td>
                      <td className="py-1 px-2 border-b border-r border-black text-center">{item.codOrigem}</td>
                      <td className="py-1 px-1 border-b border-r border-black text-center">{item.quantity}</td>
                      <td className="py-1 px-1 border-b border-r border-black text-center">{item.um}</td>
                      <td className="py-1 px-2 border-b border-r border-black text-right font-mono">R$ {formatNum(item.price)}</td>
                      <td className="py-1 px-2 border-b border-r border-black text-right font-mono">R$ {formatNum(grossPrice)}</td>
                      <td className="py-1 px-2 border-b border-r border-black text-right font-bold font-mono">R$ {formatNum(totalItem)}</td>
                    </tr>
                  );
                })
              )}
              {items.length > 0 && (<>
                <tr className="bg-gray-100 font-bold" style={{ pageBreakInside: 'avoid' }}><td colSpan="7" className="py-1 px-2 border border-black text-right">Total s/IPI:</td><td className="py-1 px-2 border border-black text-right font-mono">R$ {formatNum(subtotalBruto)}</td></tr>
                {parseFloat(cfg.desconto) > 0 && <tr className="bg-emerald-50 text-emerald-800 font-bold" style={{ pageBreakInside: 'avoid' }}><td colSpan="7" className="py-1 px-2 border border-black text-right">DESCONTO APLICADO ({cfg.desconto}%):</td><td className="py-1 px-2 border border-black text-right font-mono">- R$ {formatNum(valorDesconto)}</td></tr>}
                {totalIpi > 0 && <tr className="bg-blue-50 text-blue-800 font-bold" style={{ pageBreakInside: 'avoid' }}><td colSpan="7" className="py-1 px-2 border border-black text-right">Total IPI:</td><td className="py-1 px-2 border border-black text-right font-mono">+ R$ {formatNum(totalIpi)}</td></tr>}
                <tr className="bg-slate-100 font-bold text-[12px]" style={{ pageBreakInside: 'avoid' }}><td colSpan="7" className="py-1 px-2 border border-black text-right uppercase">Total Final:</td><td className="py-1 px-2 border border-black text-right font-mono">R$ {formatNum(total)}</td></tr>
              </>)}
            </tbody>
          </table>
       </div>
       <div className="text-[10px] mt-1 mb-4 text-black" style={{ pageBreakInside: 'avoid' }}>Código de Origem: 0-Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8</div>
       {items.length > 0 && items.some(it => { const p = products.find(prod => String(prod.id) === String(it.productId)); return it.descricao_original || p?.descricao_original; }) && (
         <div className="text-[10px] mb-4 text-black" style={{ pageBreakInside: 'avoid' }}>
            <div className="font-bold mb-1 uppercase">Descrições Detalhadas dos Materiais:</div>
            <div className="space-y-1.5">{items.map((it, idx) => { const p = products.find(prod => String(prod.id) === String(it.productId)); const desc = it.descricao_original || p?.descricao_original; if (!desc) return null; return (<div key={`desc_${it.id}`} className="text-justify leading-snug"><span className="font-bold mr-1">Item {it.numeroItem || idx + 1}:</span><span>{desc}</span></div>); })}</div>
         </div>
       )}
       <div className="border-t border-black my-4" style={{ pageBreakInside: 'avoid' }}></div>
       <div className="text-[11px] mb-4 space-y-1" style={{ pageBreakInside: 'avoid' }}>
          <div><span className="font-bold">Condição de pagamento:</span> {cfg.condicaoPagamento}</div>
          <div><span className="font-bold">Transporte:</span> {cfg.transporte}</div>
          <div><span className="font-bold">Natureza da Operação:</span> {cfg.naturezaOperacao}</div>
       </div>
       <div className="text-[11px] leading-normal flex-1 mb-8" style={{ pageBreakInside: 'avoid', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
          {cfg.observacoesAdicionais ? (<div className="text-justify">{cfg.observacoesAdicionais}</div>) : (<div className="text-gray-400 italic text-center p-4 border border-dashed border-gray-300">[ Observações / Condições Comerciais ]</div>)}
       </div>
       <footer className="mt-auto pt-2 border-t border-black text-[9px] text-center font-bold" style={{ pageBreakInside: 'avoid' }}>
          <div>Tel.: +55 31 3499-4000 | comercial@kalenborn.com.br | www.kalenborn.com.br</div>
       </footer>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-slate-100 overflow-hidden relative">
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white border-t flex z-50 h-16 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <button onClick={()=>setMobileTab('editor')} className={`flex-1 flex items-center justify-center font-black text-xs uppercase tracking-widest transition-colors cursor-pointer touch-manipulation ${mobileTab === 'editor' ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><PenTool size={16} className="mr-2"/> Editor</button>
        <button onClick={()=>setMobileTab('preview')} className={`flex-1 flex items-center justify-center font-black text-xs uppercase tracking-widest transition-colors cursor-pointer touch-manipulation ${mobileTab === 'preview' ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><FileText size={16} className="mr-2"/> PDF</button>
      </div>
      <div className={`${mobileTab==='editor'?'flex':'hidden'} lg:flex flex-col bg-white h-full shadow-xl z-40 pb-16 lg:pb-0 transition-all duration-500 shrink-0 ${isEditorVisible ? 'w-full lg:w-[480px] xl:w-[550px] translate-x-0 border-r border-slate-200' : 'w-0 -translate-x-full border-none overflow-hidden'}`}>
        <header className="px-5 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0 min-w-[400px]">
          <div><h2 className="font-black text-slate-800 text-lg uppercase tracking-tight flex items-center gap-2"><PenTool size={20} className="text-blue-600" /> Elaborador</h2><div className="text-[10px] font-bold font-mono text-slate-400 mt-1 uppercase tracking-widest">{currentProposal.numeroUnico || 'Rascunho'}</div></div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentProposal(getEmptyProposal())} className="text-xs bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors cursor-pointer touch-manipulation hidden sm:block">Limpar</button>
            <button onClick={() => saveProposalToDB(currentProposal)} className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2 active:scale-95 transition-transform cursor-pointer touch-manipulation"><Save size={14}/> Gravar</button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar bg-slate-50/50 min-w-[400px]">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex items-center gap-2 mb-3 border-b pb-2"><div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><Building size={16}/></div><h4 className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Empresa Destino</h4></div>
             <div className="space-y-3">
               <div className="relative">
                 <label className={labelClass}>Pesquisar Cliente</label>
                 <div className="relative"><input type="text" placeholder="Nome, CNPJ ou código..." value={clientSearchText} onChange={e=>{setClientSearchText(e.target.value); setShowClientDropdown(true);}} onFocus={()=>setShowClientDropdown(true)} className={fieldClass} /><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></div>
                 {showClientDropdown && filteredClients.length > 0 && (
                   <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                     {filteredClients.map(c=>(<div key={c.id} onClick={()=>{
                       const fixedIcms = c.icms !== undefined && c.icms !== null && c.icms !== '' ? (String(c.icms).includes('%') ? String(c.icms) : `${c.icms}%`) : null;
                       const targetIcmsDestino = fixedIcms || getAutoIcms(c.address || '', '0', null);
                       setCurrentProposal(p=>({...p, clientId: c.id, config: { ...p.config, contato: c.contact || 'A/C Comercial', icmsDestino: targetIcmsDestino }, items: p.items.map(i => { const isSpec = SPECIAL_ICMS_PRODUCTS.includes(String(i.productId)); const itemHasZeroIcms = String(i.icms || '').replace('%','').trim() === '0'; if (itemHasZeroIcms) return i; const finalIcms = isSpec ? getAutoIcms(c.address || '', i.codOrigem || '0', i.productId) : (fixedIcms || getAutoIcms(c.address || '', i.codOrigem || '0', i.productId)); return { ...i, icms: finalIcms }; })}));
                       setClientSearchText(c.company||c.nome); setShowClientDropdown(false); showToast(fixedIcms ? `ICMS fixo do cliente (${fixedIcms}) aplicado!` : `ICMS recalculado automaticamente!`);
                     }} className="p-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer touch-manipulation"><div className="flex justify-between items-baseline gap-2"><div className="font-bold text-sm text-slate-800">{c.company||c.nome}</div><div className="text-[10px] text-slate-400 font-bold shrink-0">#{c.id}</div></div><div className="text-[10px] text-slate-500 mt-1">{formatCNPJ(c.document||c.cnpj)}</div></div>))}
                   </div>
                 )}
               </div>
               <div><label className={labelClass}>Contato Responsável</label><input type="text" value={cfg.contato || ''} onChange={e=>updateConfig('contato', e.target.value)} className={fieldClass} /></div>
             </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-2"><div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg"><Receipt size={16}/></div><h4 className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Configuração Comercial</h4></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1"><label className={labelClass}>Referência</label><input type="text" value={cfg.referencia || ''} onChange={e => updateConfig('referencia', e.target.value)} className={fieldClass} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={labelClass}>Projeto</label><input type="text" value={cfg.projeto || ''} readOnly className={`${fieldClass} bg-slate-100 text-slate-400`} /></div>
              <div><label className={labelClass}>Pagamento</label><div className="relative"><select value={cfg.condicaoPagamento || ''} onChange={e=>updateConfig('condicaoPagamento', e.target.value)} className={`${fieldClass} appearance-none pr-8 cursor-pointer`}><option value="30 Dias">30 Dias</option><option value="15 Dias">15 Dias</option><option value="À Vista">À Vista</option><option value="Antecipado">Antecipado</option><option value="De acordo com o portal">De acordo com o portal</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/></div></div>
              <div><label className={labelClass}>Transporte</label><div className="relative"><select value={cfg.transporte || ''} onChange={e=>updateConfig('transporte', e.target.value)} className={`${fieldClass} appearance-none pr-8 cursor-pointer`}><option value="CIF">CIF (Incluso)</option><option value="FOB">FOB (Cliente)</option><option value="EXW">EXW Vespasiano</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/></div></div>
              <div className="col-span-2"><label className={labelClass}>Operação</label><div className="relative"><select value={cfg.naturezaOperacao || ''} onChange={e => updateConfig('naturezaOperacao', e.target.value)} className={`${fieldClass} appearance-none pr-8 cursor-pointer`}><option value="Venda para Consumo">Consumo Final</option><option value="Venda Industrialização">Industrialização</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/></div></div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b pb-2"><div className="flex items-center gap-2"><div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg"><FileText size={16}/></div><h4 className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Materiais</h4></div><button onClick={() => setActiveTab('catalog')} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"><Search size={12}/> Catálogo</button></div>
            {items.length === 0 && <div className="p-6 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl font-bold text-xs uppercase">Nenhum Material Adicionado</div>}
            <div className="space-y-3">
              <div className="flex gap-2 mb-4 items-center bg-slate-50 p-2 rounded-xl border">
                 <select className="flex-1 bg-transparent p-2 text-sm focus:border-blue-500 outline-none text-slate-700 font-medium min-w-0" value={quickAddProductId} onChange={(e) => setQuickAddProductId(e.target.value)}>
                    <option value="">Procurar material rápido...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.codKalenborn} {p.codvale ? `(Vale: ${p.codvale})` : ''} - R$ {formatNum(p.price)}</option>)}
                 </select>
                 <button onClick={handleQuickAdd} disabled={!quickAddProductId} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-lg cursor-pointer"><Plus size={18}/></button>
              </div>
              {items.map(it => {
                const gp = calculateGrossPrice(it.price, it.icms, it.pisCofins);
                const t = (gp * it.quantity) * (1 + ((parseFloat(it.ipi) || 0) / 100));
                const isTechSheetEligible = (it.codKalenborn?.toLowerCase().includes('bandeja') || it.codKalenborn?.toLowerCase().includes('kalimpact') || it.codKalenborn?.toLowerCase().includes('placa'));
                return (
                  <div key={it.id} className="p-3 bg-white border border-slate-200 shadow-sm rounded-lg relative group transition-all animate-in fade-in slide-in-from-left-2">
                    <button onClick={() => removeItem(it.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1.5 bg-slate-50 rounded transition-colors cursor-pointer"><Trash2 size={14}/></button>
                    <div className="flex gap-2 mb-2 pr-8"><input type="text" value={it.numeroItem || ''} onChange={e=>updateItem(it.id, 'numeroItem', e.target.value)} className="w-8 border-b border-slate-200 text-center font-bold text-xs outline-none focus:border-blue-500 pb-1" /><div className="flex-1 flex flex-col"><input type="text" value={it.codKalenborn || ''} onChange={e=>updateItem(it.id, 'codKalenborn', e.target.value)} className="w-full border-b border-slate-200 font-bold text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-500 pb-1 truncate uppercase" /><div className="text-[9px] text-slate-500 mt-1 uppercase font-bold">KBN: {it.productId} {it.codvale ? `| VALE: ${it.codvale}` : ''}</div></div></div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Qtd</label><input type="number" step="0.01" value={it.quantity || ''} onChange={e=>updateItem(it.id, 'quantity', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center text-blue-600 outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">UN</label><input type="text" value={it.um || ''} onChange={e=>updateItem(it.id, 'um', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Líq (R$)</label><input type="number" step="0.01" value={it.price || ''} onChange={e=>updateItem(it.id, 'price', e.target.value)} className="w-full bg-emerald-50 border border-emerald-100 rounded p-1.5 text-xs font-black text-center text-emerald-700 outline-none" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3 border-t border-slate-50 pt-3">
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">ICMS (%)</label><input type="text" value={it.icms || ''} onChange={e=>updateItem(it.id, 'icms', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">PIS/COF</label><input type="text" value={it.pisCofins || ''} onChange={e=>updateItem(it.id, 'pisCofins', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">IPI (%)</label><input type="text" value={it.ipi || ''} onChange={e=>updateItem(it.id, 'ipi', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2 text-white flex justify-between items-center px-4 shadow-inner border border-slate-800"><div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Bruto Unitário: <span className="text-slate-200 ml-1">R$ {formatNum(gp)}</span></div><div className="text-[10px] font-black text-emerald-400 uppercase">Total: R$ {formatNum(t)}</div></div>
                    {isTechSheetEligible && (
                      <div className="mt-2 text-right border-t border-slate-100 pt-2">
                        <button onClick={() => { setSelectedTechSheetId(it.productId); setActiveTab('technicalSheet'); }} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer flex items-center gap-1 justify-end ml-auto"><FileText size={12}/> Abrir Ficha Técnica desta Peça</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {items.length > 0 && (
              <div className="bg-[#0F172A] p-6 rounded-xl shadow-xl mt-6 border border-slate-800 relative overflow-hidden group">
                 <div className="lg:hidden flex justify-between items-center mb-4 relative z-10 border-b border-white/10 pb-4"><span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Desc. Comercial (%)</span><input type="number" step="0.1" max="3" min="0" value={cfg.desconto || 0} onChange={handleDescontoChange} className="w-20 bg-slate-800 border border-slate-600 text-white rounded-lg p-2 text-center text-xs outline-none focus:border-blue-500 shadow-inner" /></div>
                 <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10"><span>Subtotal Bruto (s/IPI):</span><span className="font-mono text-slate-200">R$ {formatNum(subtotalBruto)}</span></div>
                 {parseFloat(cfg.desconto) > 0 && <div className="flex justify-between text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10"><span>Desconto ({cfg.desconto}%):</span><span className="font-mono">- R$ {formatNum(valorDesconto)}</span></div>}
                 {totalIpi > 0 && <div className="flex justify-between text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4 relative z-10"><span>IPI Total:</span><span className="font-mono">+ R$ {formatNum(totalIpi)}</span></div>}
                 <div className="flex justify-between text-white font-black text-2xl border-t border-white/10 mt-2 pt-4 tracking-tighter uppercase relative z-10"><span>Total Geral:</span><span className="text-emerald-400 font-mono">R$ {formatNum(total)}</span></div>
              </div>
            )}
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b pb-2"><div className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><FileWarning size={16}/></div><h4 className="font-bold text-slate-700 text-sm">Observações da Proposta</h4></div>
            <div className="relative mb-3"><select onChange={e => { if(!e.target.value) return; const obs = observations.find(o => o.id === e.target.value); if(obs) updateConfig('observacoesAdicionais', (cfg.observacoesAdicionais ? cfg.observacoesAdicionais + '\n\n' : '') + (obs.desc_text || obs.desc)); e.target.value=''; }} className="w-full bg-purple-50 border border-purple-100 text-purple-800 text-xs font-black uppercase tracking-widest rounded-xl px-4 py-3 outline-none cursor-pointer appearance-none shadow-sm touch-manipulation"><option value="">+ Puxar texto padrão do sistema...</option>{observations.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" size={14}/></div>
            <textarea rows="5" value={cfg.observacoesAdicionais || ''} onChange={e => updateConfig('observacoesAdicionais', e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded-xl p-4 text-xs font-mono outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all shadow-inner" placeholder="Inserir termos comerciais padrão Kalenborn..." />
          </div>
        </div>
        <div className="p-4 bg-white border-t border-slate-200 hidden lg:flex gap-4 shrink-0 z-50 w-[480px] xl:w-[550px]">
           <div className="w-24 text-center"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Desc %</label><input type="number" step="0.1" max="3" min="0" value={cfg.desconto || 0} onChange={handleDescontoChange} className="w-full border-2 border-slate-200 h-12 rounded-xl text-sm font-black text-center outline-none focus:border-blue-500 bg-white shadow-sm" /></div>
           <button onClick={handleGeneratePDFAndUpload} disabled={isGeneratingPDF} className="flex-1 bg-[#0F172A] text-white font-black py-4 rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 mt-4 cursor-pointer touch-manipulation">{isGeneratingPDF ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />} <span>Baixar PDF Oficial</span></button>
        </div>
      </div>
      <button onClick={() => setIsEditorVisible(!isEditorVisible)} className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-[60] bg-white border border-slate-200 shadow-2xl h-14 w-8 items-center justify-center rounded-r-2xl text-slate-400 hover:text-blue-600 transition-all duration-500 cursor-pointer" style={{ left: isEditorVisible ? (windowWidth >= 1280 ? '550px' : '480px') : '0px' }}>
         {isEditorVisible ? <ChevronLeft size={20}/> : <ChevronRight size={20}/>}
      </button>
      <div id="print-scroll-container" className={`${mobileTab === 'editor' ? 'hidden' : 'flex'} lg:flex flex-1 h-full bg-slate-200 justify-center overflow-x-hidden overflow-y-auto pt-8 pb-32 lg:pb-8 custom-scrollbar relative z-10 w-full`}>
         <div className="pdf-preview-wrapper flex justify-center mx-auto shrink-0" style={{ width: '210mm', transform: `scale(${pdfScale})`, transformOrigin: 'top center', height: 'fit-content', transition: 'transform 0.3s ease' }}>
            <div className="bg-white shadow-2xl box-border" id="documento-pdf-real" style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }}>{renderPdfLayout()}</div>
         </div>
         <div className="lg:hidden fixed bottom-20 left-4 right-4 z-[70]">
           <button onClick={handleGeneratePDFAndUpload} disabled={isGeneratingPDF} className="w-full bg-[#0F172A] text-white font-black py-4 rounded-xl shadow-2xl flex justify-center items-center gap-2 uppercase tracking-widest cursor-pointer touch-manipulation active:scale-95 transition-transform">{isGeneratingPDF ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />} Gerar PDF Oficial</button>
         </div>
      </div>
      {isGeneratingPDF && (<div className="fixed inset-0 z-[999999] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white"><RefreshCw className="animate-spin text-blue-500 mb-4" size={48} /><h2 className="text-2xl font-black uppercase tracking-widest">Processando PDF</h2><p className="text-slate-300 mt-2 font-medium text-center px-4">Por favor aguarde, gerando arquivo com qualidade máxima...</p></div>)}
    </div>
  );
}


// ==========================================
// GESTÃO CRM
// ==========================================
function ManagementView({ proposals, clients, updateStatus, loadProposalForEditing, deleteProposal }) {
  const [filter, setFilter] = useState('Todas');
  const [proposalToDelete, setProposalToDelete] = useState(null);
  const filtered = proposals.filter(p => filter === 'Todas' || p.status === filter);
  const dashboard = useMemo(() => {
     let totalL = 0; let totalA = 0; let qtdA = 0; let totalP = 0; let qtdP = 0;
     proposals.forEach(p => { const val = parseFloat(p.total) || 0; totalL += val; if(p.status === 'Aceita') { totalA += val; qtdA++; } if(p.status === 'Pendente') { totalP += val; qtdP++; } });
     return { totalL, totalA, qtdA, totalP, qtdP };
  }, [proposals]);
  const Card = ({ label, val, qtd, color, icon: Icon }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between animate-in slide-in-from-top-2">
      <div className={`text-[10px] font-black uppercase tracking-widest ${color} flex items-center justify-between`}><Icon size={20}/> <span>{label}</span></div>
      <div className="mt-4"><div className="text-2xl font-black text-slate-800 tracking-tighter">R$ {formatNum(val)}</div><div className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{qtd !== undefined ? `${qtd} Propostas` : 'Total Global'}</div></div>
    </div>
  );
  return (
    <div className="p-4 sm:p-6 lg:p-10 h-full flex flex-col bg-slate-50 overflow-hidden font-sans relative">
       <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 shrink-0">
          <div><h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tighter uppercase">Gestão CRM</h1><div className="h-1 w-12 bg-blue-600 mt-2 rounded-full"></div></div>
          <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto w-full sm:w-auto custom-scrollbar">{['Todas', 'Pendente', 'Aceita', 'Recusada'].map(s => <button key={s} onClick={()=>setFilter(s)} className={`cursor-pointer touch-manipulation px-4 sm:px-5 py-2 sm:py-2.5 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${filter===s?'bg-slate-900 text-white shadow-xl':'text-slate-400 hover:bg-slate-50'}`}>{s}</button>)}</div>
       </header>
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-8 shrink-0">
          <Card label="Faturamento Total" val={dashboard.totalL} color="text-blue-600" icon={Globe} />
          <Card label="Aceitas (Fechado)" val={dashboard.totalA} qtd={dashboard.qtdA} color="text-emerald-600" icon={Handshake} />
          <Card label="Em Aberto" val={dashboard.totalP} qtd={dashboard.qtdP} color="text-amber-600" icon={Clock} />
       </div>
       <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-in fade-in duration-500">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="p-4 sm:p-5">Nº Proposta</th><th className="p-4 sm:p-5">Vendedor</th><th className="p-4 sm:p-5">Cliente</th><th className="p-4 sm:p-5 text-center">Status</th><th className="p-4 sm:p-5 text-right">Valor Total</th><th className="p-4 sm:p-5 text-center">Ações</th></tr></thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 sm:p-5 font-black font-mono text-blue-700">{p.numeroUnico}</td>
                    <td className="p-4 sm:p-5 font-bold text-slate-800 text-xs capitalize">{p.config?.vendedor || '---'}</td>
                    <td className="p-4 sm:p-5 font-bold text-slate-600 text-xs uppercase min-w-[150px]">{clients.find(c=>c.id===p.clientId)?.company || 'Desconhecido'}</td>
                    <td className="p-4 sm:p-5 text-center"><select value={p.status} onChange={e=>updateStatus(p.id, e.target.value)} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none shadow-sm border cursor-pointer appearance-none text-center ${p.status==='Aceita'?'bg-emerald-50 text-emerald-600 border-emerald-100':'bg-amber-50 text-amber-600 border-amber-100'}`}><option value="Pendente">Pendente</option><option value="Aceita">Aceita</option><option value="Recusada">Recusada</option></select></td>
                    <td className="p-4 sm:p-5 text-right font-black text-slate-700 font-mono">R$ {formatNum(p.total)}</td>
                    <td className="p-4 sm:p-5 text-center"><div className="flex justify-center gap-2"><button onClick={() => loadProposalForEditing(p)} className="p-2 sm:h-10 sm:w-10 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all touch-manipulation shadow-sm flex items-center justify-center cursor-pointer"><Edit size={16}/></button>{p.attachment_url && <a href={p.attachment_url} target="_blank" rel="noreferrer" className="p-2 sm:h-10 sm:w-10 text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center cursor-pointer"><Download size={16}/></a>}<button onClick={() => setProposalToDelete(p)} className="p-2 sm:h-10 sm:w-10 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-600 hover:text-white transition-all touch-manipulation shadow-sm flex items-center justify-center cursor-pointer"><Trash2 size={16}/></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
       </div>
       {proposalToDelete && (
         <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
             <div className="p-6 text-center"><div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={32} /></div><h3 className="text-xl font-black text-slate-800 mb-2">Excluir Proposta?</h3><p className="text-sm text-slate-500 mb-6">Tem a certeza que deseja excluir a proposta <strong className="text-slate-800">{proposalToDelete.numeroUnico}</strong>? Esta ação não pode ser desfeita.</p><div className="flex gap-3"><button onClick={() => setProposalToDelete(null)} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button><button onClick={() => { deleteProposal(proposalToDelete.id); setProposalToDelete(null); }} className="flex-1 py-3 text-white font-bold bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer">Sim, Excluir</button></div></div>
           </div>
         </div>
       )}
    </div>
  );
}

// ==========================================
// SIMULADOR 3D
// ==========================================
function SimulatorView({ showToast, refreshData, products = [] }) {
    const [currentKey, setCurrentKey] = useState('WPHSKRX-774');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isInfoOpen, setInfoOpen] = useState(window.innerWidth >= 768);
    const [isWireframe, setWireframe] = useState(false);
    const [isAssembled, setAssembled] = useState(true);
    const [isAutoRotate, setAutoRotate] = useState(false);
    const [isPanMode, setPanMode] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
    const [targetProductId, setTargetProductId] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [simProductMap, setSimProductMap] = useState(() => {
        try { return JSON.parse(localStorage.getItem('kbn_sim_product_map') || '{}'); } catch (e) { return {}; }
    });
    const canvasRef = useRef(null);
    const labelsRef = useRef(null);
    const sceneManager = useRef(null);
    const activeProject = simulatorDatabase[currentKey];
    useEffect(() => {
        if (!sceneManager.current && canvasRef.current && labelsRef.current) {
            sceneManager.current = new SceneManager(canvasRef.current, labelsRef.current);
            sceneManager.current.loadProject(activeProject);
        }
        return () => { if(sceneManager.current) sceneManager.current.dispose(); };
    }, []);
    useEffect(() => { if (sceneManager.current) sceneManager.current.loadProject(activeProject); }, [currentKey, activeProject]);
    useEffect(() => { if (sceneManager.current) sceneManager.current.setWireframe(isWireframe); }, [isWireframe]);
    useEffect(() => { if (sceneManager.current) sceneManager.current.setAssembled(isAssembled); }, [isAssembled]);
    useEffect(() => { if (sceneManager.current) sceneManager.current.setAutoRotate(isAutoRotate); }, [isAutoRotate]);
    useEffect(() => { if (sceneManager.current) sceneManager.current.setPanMode(isPanMode); }, [isPanMode]);

    const filteredProducts = useMemo(() => {
        if (!productSearch) return products;
        const lower = productSearch.toLowerCase();
        return products.filter(p =>
            (p.name && p.name.toLowerCase().includes(lower)) ||
            (p.codkalenborn && p.codkalenborn.toLowerCase().includes(lower)) ||
            (p.codvale && String(p.codvale).toLowerCase().includes(lower)) ||
            (p.id && String(p.id).toLowerCase().includes(lower))
        );
    }, [products, productSearch]);

    const handleConfirmCapture = async () => {
        if (!sceneManager.current || !targetProductId) return;
        setIsCapturing(true);
        try {
            const dataUrl = sceneManager.current.exportImage();
            const blob = await (await fetch(dataUrl)).blob();
            const fileName = `produtos/${targetProductId}_3d_${Date.now()}.png`;
            const url = await supabaseUpload('portal-files', fileName, blob);
            await supabaseRequest('products', 'POST', { id: targetProductId, imagem_url: url }, true);
            const nextMap = { ...simProductMap, [currentKey]: targetProductId };
            setSimProductMap(nextMap);
            localStorage.setItem('kbn_sim_product_map', JSON.stringify(nextMap));
            showToast?.(`✅ Imagem 3D salva na Ficha Técnica do produto ${targetProductId}!`);
            refreshData?.();
            setIsCaptureModalOpen(false);
            setTargetProductId('');
        } catch (err) {
            showToast?.('Erro ao capturar/salvar imagem.');
        } finally {
            setIsCapturing(false);
        }
    };

    const handleQuickCapture = async () => {
        const linkedId = simProductMap[currentKey];
        const stillExists = products.some(p => String(p.id) === String(linkedId));
        if (!linkedId || !stillExists) { setIsCaptureModalOpen(true); return; }
        if (!sceneManager.current) return;
        setIsCapturing(true);
        try {
            const dataUrl = sceneManager.current.exportImage();
            const blob = await (await fetch(dataUrl)).blob();
            const fileName = `produtos/${linkedId}_3d_${Date.now()}.png`;
            const url = await supabaseUpload('portal-files', fileName, blob);
            await supabaseRequest('products', 'POST', { id: linkedId, imagem_url: url }, true);
            showToast?.(`✅ Imagem 3D atualizada na Ficha Técnica do produto ${linkedId}!`);
            refreshData?.();
        } catch (err) {
            showToast?.('Erro ao capturar/salvar imagem.');
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 relative overflow-hidden font-sans">
            <header className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4 shadow-sm z-30">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <h1 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><Box size={20} className="text-sky-600" /> Simulador 3D</h1>
                    <select value={currentKey} onChange={e => setCurrentKey(e.target.value)} className="flex-1 sm:w-[400px] p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold shadow-inner outline-none focus:border-sky-500 cursor-pointer text-slate-700">
                        {Object.keys(simulatorDatabase).map(k => (<option key={k} value={k}>{simulatorDatabase[k].dimsStr}</option>))}
                    </select>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                    <div className="flex-1 sm:flex-none flex rounded-xl shadow-md overflow-hidden">
                        <button onClick={handleQuickCapture} disabled={isCapturing} className="px-4 py-3 transition-all cursor-pointer bg-emerald-600 text-white font-bold text-xs uppercase flex items-center gap-2 disabled:opacity-60" title={simProductMap[currentKey] ? `Capturar e salvar direto no produto ${simProductMap[currentKey]}` : 'Capturar imagem e vincular a um produto'}>
                            {isCapturing ? <RefreshCw size={16} className="animate-spin"/> : <Camera size={16}/>} Usar na Ficha Técnica
                        </button>
                        <button onClick={() => setIsCaptureModalOpen(true)} className="px-2.5 border-l border-emerald-500 bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer flex items-center justify-center" title="Trocar produto vinculado" onMouseDown={() => setTargetProductId(simProductMap[currentKey] || '')}><ChevronDown size={14}/></button>
                    </div>
                    <button onClick={() => setWireframe(!isWireframe)} className={`flex-1 sm:flex-none p-3 rounded-xl border transition-all shadow-md cursor-pointer ${isWireframe ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'}`}><Grid size={18}/></button>
                    <button onClick={() => setAssembled(!isAssembled)} className={`flex-1 sm:flex-none p-3 rounded-xl border transition-all shadow-md active:scale-95 touch-manipulation cursor-pointer ${!isAssembled ? 'bg-orange-600 text-white' : 'bg-white text-slate-600'}`} title="Desmontar"><Wrench size={18}/></button>
                    <button onClick={() => setAutoRotate(!isAutoRotate)} className={`flex-1 sm:flex-none p-3 rounded-xl border transition-all shadow-md cursor-pointer ${isAutoRotate ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}><RefreshCw size={18} className={isAutoRotate ? 'animate-spin' : ''}/></button>
                </div>
            </header>
            {simProductMap[currentKey] && (
                <div className="absolute top-[76px] left-4 z-30 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm">
                    Vinculado ao produto {simProductMap[currentKey]}
                </div>
            )}
            <div ref={canvasRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing z-10" />
            <div ref={labelsRef} className="absolute inset-0 pointer-events-none z-20" />
            <div className="absolute bottom-6 left-6 right-6 lg:left-auto lg:w-80 bg-white/95 backdrop-blur border border-slate-200 p-5 rounded-2xl shadow-2xl z-30">
                <div className="flex items-center gap-2 mb-3 text-sky-600 font-black uppercase text-[10px] tracking-widest border-b pb-2"><Info size={14}/> Ficha Técnica</div>
                <div className="space-y-3">
                    <div className="text-slate-800 font-bold text-sm tracking-tight">{activeProject.type}</div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100"><div className="flex justify-between items-center text-xs"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cód KBN</span><span className="font-bold text-slate-700">{activeProject.id}</span></div></div>
                    <div className="grid grid-cols-2 gap-4 pt-1">
                        <div><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dimensões</div><div className="text-slate-700 font-black text-xs">{activeProject.dimsStr}</div></div>
                        <div className="text-right"><div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Parafuso</div><div className="text-orange-600 font-black text-xs">{activeProject.screwStr}</div></div>
                    </div>
                </div>
            </div>

            {isCaptureModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-black flex items-center gap-2"><Camera size={18}/> Salvar imagem na Ficha Técnica</h3>
                            <button onClick={() => { setIsCaptureModalOpen(false); setTargetProductId(''); }} className="text-emerald-200 hover:text-white cursor-pointer"><X size={20}/></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-xs text-slate-500">Escolha qual produto cadastrado vai receber esta imagem capturada do simulador.</p>
                            <input type="text" placeholder="Buscar produto (nome, Cód KBN, Cód Vale)..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
                            <div className="max-h-64 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg divide-y">
                                {filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => setTargetProductId(p.id)} className={`w-full text-left p-3 transition-colors cursor-pointer ${targetProductId === p.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                                        <div className="font-bold text-xs line-clamp-1">{p.codkalenborn || p.name}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">KBN: {p.id} {p.codvale ? `| Vale: ${p.codvale}` : ''}</div>
                                    </button>
                                ))}
                                {filteredProducts.length === 0 && <div className="text-center p-4 text-xs text-slate-400">Nenhum produto encontrado.</div>}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 flex gap-3 border-t">
                            <button onClick={() => { setIsCaptureModalOpen(false); setTargetProductId(''); }} className="flex-1 py-3 font-bold text-slate-600 bg-white border rounded-xl cursor-pointer hover:bg-slate-100">Cancelar</button>
                            <button onClick={handleConfirmCapture} disabled={!targetProductId || isCapturing} className="flex-1 py-3 font-black bg-emerald-600 text-white rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-700 disabled:opacity-50">
                                {isCapturing ? <RefreshCw size={16} className="animate-spin"/> : <Save size={16}/>} Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// FICHA TÉCNICA
// ==========================================
// ==========================================
// EDITOR DE TABELA DINÂMICA (Composição / Propriedades)
// ==========================================
// ==========================================
// EXTRAÇÃO AUTOMÁTICA DE CARACTERÍSTICAS TÉCNICAS
// Lê o texto corrido já cadastrado (campo "característica") e
// transforma em linhas de tabela, sem precisar digitar nada de novo.
// ==========================================
function parseFeaturesFromText(text) {
  if (!text) return [];
  const rows = [];
  const addRow = (label, value) => {
    if (value && String(value).trim()) rows.push({ caracteristica: label, valor: String(value).trim().replace(/\s+/g, ' ').replace(/[,.;]+$/, '') });
  };

  let m = text.match(/dimens(?:[õo]es|ão)\s*(?:de\s*)?(\d+)\s*(?:x|×)\s*(\d+)\s*mm/i);
  if (m) addRow('Dimensões / Dimensions', `${m[1]}×${m[2]} mm`);

  m = text.match(/espessura total (?:d[ae]\s*)?(?:chapa de desgaste|placa de desgaste|revestimento)?:?\s*([\d,]+)\s*mm/i);
  if (m) addRow('Espessura total / Total thickness', `${m[1]} mm`);

  const chapaMatch = text.match(/chapa base[\s\S]{0,160}?(?=e cer[âa]mica|cer[âa]mica de alta alumina)/i);
  if (chapaMatch) {
    const sub = chapaMatch[0];
    const grade = (sub.match(/ASTM\s*[\w\d]+/i) || [])[0];
    const esp = (sub.match(/espessura\s*(?:de\s*)?([\d,]+)\s*mm/i) || [])[1];
    const abas = (sub.match(/(sem abas laterais|com abas laterais e al[çc]a|com abas laterais|com aba|com al[çc]a)/i) || [])[0];
    const acabamento = (sub.match(/acabamento\s+(\w+)/i) || [])[1];
    addRow('Chapa base / Steel backing', [grade, esp ? `${esp} mm` : null, acabamento, abas].filter(Boolean).join(' · '));
  }

  const revMatch = text.match(/cer[âa]mica de alta alumina[\s\S]{0,140}?(?=fixada|sobre base)/i);
  if (revMatch) {
    const sub = revMatch[0];
    const pct = (sub.match(/(\d{2,3}(?:[.,]\d+)?)\s*%/) || [])[1];
    const marca = /kalocer/i.test(sub) ? 'Kalocer' : null;
    const esp = (sub.match(/espessura\s*(?:de\s*)?([\d,]+)\s*mm/i) || [])[1];
    addRow('Revestimento / Ceramic lining', `${marca ? marca + ' ' : ''}alta alumina${pct ? ' ' + pct + '%' : ''}${esp ? ' · ' + esp + ' mm' : ''}`);
  }

  const magMatch = text.match(/base magn[ée]tica\s*espessura\s*([\d,]+)\s*mm/i);
  if (magMatch) {
    addRow('Base Magnética / Magnetic base', `${magMatch[1]} mm`);
  } else {
    const borrMatch = text.match(/borracha natural[\s\S]{0,120}?(?=\.|incluindo|incluso)/i);
    if (borrMatch) {
      const sub = borrMatch[0];
      const dureza = (sub.match(/(\d+)\s*Shore\s*A/i) || [])[1];
      const esp = (sub.match(/espessura\s*(?:de\s*)?([\d,]+)\s*mm/i) || [])[1];
      const val = [dureza ? `${dureza} Shore A` : null, esp ? `${esp} mm` : null].filter(Boolean).join(' · ');
      if (val) addRow('Elemento elástico / Rubber cushion', `Borracha natural · ${val}`);
    }
  }

  const fixMatch = text.match(/inclu(?:indo|so)[\s\S]{0,180}?(?=\.|espessura total)/i);
  if (fixMatch) {
    const val = fixMatch[0].replace(/^inclu(?:indo|so)\s*/i, '').replace(/para montagem no equipamento/i, '').trim();
    addRow('Fixação / Fastening', val);
  }

  m = text.match(/temperatura m[áa]xima de opera[çc][ãa]o:?\s*(\d+)\s*°?\s*C?/i);
  if (m) addRow('Temp. máx. de operação / Max. service temp.', `${m[1]} °C`);

  m = text.match(/desenho de refer[êe]ncia:?\s*([^\.\n]+)/i);
  if (m && !/sem desenho/i.test(m[1])) addRow('Desenho de referência / Reference drawing', m[1]);

  m = text.match(/refer[êe]ncia kalenborn:?\s*([^\.\n]+)/i);
  if (m) addRow('Referência Kalenborn', m[1]);

  return rows;
}

function TableEditor({ label, rows, columns, onChange }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const updateRow = (idx, key, value) => {
    const next = safeRows.map((r, i) => i === idx ? { ...r, [key]: value } : r);
    onChange(next);
  };
  const addRow = () => {
    const blank = {}; columns.forEach(c => blank[c.key] = '');
    onChange([...safeRows, blank]);
  };
  const removeRow = (idx) => onChange(safeRows.filter((_, i) => i !== idx));

  return (
    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
        <button type="button" onClick={addRow} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"><Plus size={12}/> Adicionar linha</button>
      </div>
      {safeRows.length === 0 && <div className="text-[11px] text-slate-400 italic py-2">Nenhum item adicionado.</div>}
      <div className="space-y-2">
        {safeRows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {columns.map(col => (
              <input
                key={col.key}
                type="text"
                value={row[col.key] || ''}
                placeholder={col.placeholder}
                onChange={e => updateRow(idx, col.key, e.target.value)}
                className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 text-xs focus:border-blue-500 outline-none bg-white"
              />
            ))}
            <button type="button" onClick={() => removeRow(idx)} className="w-8 h-8 shrink-0 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white flex items-center justify-center cursor-pointer"><Trash2 size={13}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListEditor({ label, items, placeholder, onChange }) {
  const safeItems = Array.isArray(items) ? items : [];
  const text = safeItems.join('\n');
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50/50">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{label} <span className="font-normal normal-case text-slate-400">(um item por linha)</span></label>
      <textarea
        rows="4"
        value={text}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value.split('\n'))}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:border-blue-500 outline-none bg-white resize-y"
      />
    </div>
  );
}

function TechnicalSheetView({ products, customLogo, showToast, initialSelectedId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(initialSelectedId || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mostrarCodVale, setMostrarCodVale] = useState(true);
  const [isListVisible, setIsListVisible] = useState(true);

  const eligibleProducts = useMemo(() => {
    return products.filter(p => {
      const txt = `${p.name} ${p.codKalenborn} ${p.descricao_original || ''} ${p.caracteristica || ''} ${p.id}`.toLowerCase();
      return txt.includes('bandeja') || txt.includes('kalimpact') || txt.includes('wphskrx') || txt.includes('kbwpklt') || txt.includes('placa');
    });
  }, [products]);

  const filtered = useMemo(() => {
    if (!searchTerm) return eligibleProducts;
    const lower = searchTerm.toLowerCase();
    return eligibleProducts.filter(p => 
      (p.name && p.name.toLowerCase().includes(lower)) || 
      (p.codKalenborn && p.codKalenborn.toLowerCase().includes(lower)) ||
      (p.codvale && String(p.codvale).toLowerCase().includes(lower)) ||
      (p.id && String(p.id).toLowerCase().includes(lower))
    );
  }, [searchTerm, eligibleProducts]);

  useEffect(() => { if (filtered.length > 0 && !selectedId) setSelectedId(filtered[0].id); }, [filtered, selectedId]);
  useEffect(() => { if (initialSelectedId) { setSelectedId(initialSelectedId); if (window.innerWidth < 1024) setIsListVisible(false); } }, [initialSelectedId]);

  const selectedProduct = eligibleProducts.find(p => p.id === selectedId) || eligibleProducts[0];

  const handleDownload = async () => {
    if (!window.html2pdf || !selectedProduct) return;
    setIsGenerating(true);
    setTimeout(async () => {
      const element = document.getElementById('ficha-tecnica-pdf-real');
      const opt = { margin: 0, filename: `Ficha_Tecnica_${selectedProduct.codvale || selectedProduct.id}.pdf`, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 2, dpi: 300, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } };
      try { await window.html2pdf().set(opt).from(element).save(); showToast("Ficha Técnica baixada!"); }
      catch(e) { showToast("Erro ao gerar PDF."); }
      finally { setIsGenerating(false); }
    }, 100);
  };

  const renderFicha = () => {
    if (!selectedProduct) return null;
    const composicao = Array.isArray(selectedProduct.composicao_quimica) ? selectedProduct.composicao_quimica : [];
    const manualProps = Array.isArray(selectedProduct.propriedades_material) ? selectedProduct.propriedades_material : [];
    const propriedades = manualProps.length > 0 ? manualProps : parseFeaturesFromText(selectedProduct.caracteristica || '');
    const camadas = Array.isArray(selectedProduct.camadas_construcao) ? selectedProduct.camadas_construcao : [];

    const fixacaoRow = propriedades.find(r => /fixa[çc][ãa]o/i.test(r.caracteristica || ''))?.valor;
    const desenhoRow = propriedades.find(r => /desenho de refer[êe]ncia/i.test(r.caracteristica || ''))?.valor;

    const aplicacaoDefault = [
      'Revestimento de chutes, calhas e caixas de transferência sujeitos a impacto de minério.',
      'Pontos de queda com material granulado e abrasivo, com temperatura de superfície até 80 °C.',
      'Áreas onde a borracha isolada não resiste à abrasão e a cerâmica isolada não absorve o impacto.',
      'Substituição direta de chapas de desgaste metálicas, com redução de peso e de ruído operacional.'
    ];
    const montagemDefault = [
      'Limpar a superfície do equipamento, removendo material aderido, rebarbas e cordões de solda.',
      desenhoRow ? `Conferir a posição dos furos conforme o desenho ${desenhoRow}.` : 'Conferir a posição dos furos conforme o desenho técnico do equipamento.',
      'Posicionar a chapa com a face cerâmica voltada para o fluxo de material.',
      fixacaoRow ? `Montar o kit de fixação: ${fixacaoRow}.` : 'Montar o kit de fixação (prisioneiro, arruela e porca) conforme especificação técnica.',
      'Apertar as porcas em sequência cruzada, sem sobreaperto do coxim de borracha.',
      'Montar as chapas adjacentes com junta fechada, evitando frestas expostas ao fluxo.'
    ];
    const observacoesDefault = [
      'A temperatura máxima de operação é limitada pela borracha de vulcanização, não pela cerâmica.',
      'Não soldar, cortar ou furar a chapa após a vulcanização; qualquer adequação deve ser solicitada à Kalenborn.',
      'Impactos concentrados de blocos acima do dimensionado podem trincar as pastilhas cerâmicas — avaliar a granulometria antes da aplicação.',
      'Peso e demais dados de embalagem sob consulta ao departamento comercial.'
    ];

    const customAplicacao = (Array.isArray(selectedProduct.aplicacao_recomendada) ? selectedProduct.aplicacao_recomendada : []).filter(Boolean);
    const customMontagem = (Array.isArray(selectedProduct.instrucoes_montagem) ? selectedProduct.instrucoes_montagem : []).filter(Boolean);
    const customObserv = (Array.isArray(selectedProduct.observacoes) ? selectedProduct.observacoes : []).filter(Boolean);

    const aplicacao = customAplicacao.length > 0 ? customAplicacao : aplicacaoDefault;
    const montagem = customMontagem.length > 0 ? customMontagem : montagemDefault;
    const observ = customObserv.length > 0 ? customObserv : observacoesDefault;

    const nomeExibicao = (selectedProduct.name || selectedProduct.codkalenborn || selectedProduct.id || '').toUpperCase();

    // Escapa texto pra não quebrar o HTML (mantém apenas <strong> que a gente mesmo insere)
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Negrita palavras-chave técnicas na descrição, igual ao texto de exemplo do modelo
    const boldKeywords = (text) => {
      const termos = ['KALIMPACT', 'cer[âa]mica de alta alumina[^,.;]*', 'ASTM\\s*[A-Z0-9]+', 'borracha natural(?:\\s+vulcanizada)?', 'Kalocer'];
      const combinada = new RegExp(termos.join('|'), 'gi');
      return esc(text).replace(combinada, (m) => `<strong>${m}</strong>`);
    };

    const imgProduto = selectedProduct.imagem_url
      ? `<img src="${esc(selectedProduct.imagem_url)}" style="max-width:100%;max-height:100%;object-fit:contain">`
      : `<span style="color:#B4B8BE;font-size:9pt;font-style:italic">Foto ou desenho do produto</span>`;

    const camadasHtml = camadas.length > 0 ? `
      <div style="margin-top:4px;border-left:3px solid #FFD200;background:#FAFAF6;padding:7px 10px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11pt;letter-spacing:.06em;text-transform:uppercase">Construção em ${camadas.length} camadas</div>
        <div style="display:flex;flex-direction:column;gap:3px;margin-top:5px;font-size:9.5pt;line-height:1.3">
          ${camadas.map((c, i) => `<div${i === camadas.length - 1 ? ' style="border-top:1px solid #D8D8CE;padding-top:3px;margin-top:2px"' : ''}><strong>${esc(c.espessura)}</strong> — ${esc(c.material)}</div>`).join('')}
        </div>
      </div>` : '';

    const featuresRows = propriedades.map(r => `
      <tr style="border-bottom:1px solid #E4E6E9">
        <td style="padding:4px 8px 4px 0;width:42%;color:#3A3F46;vertical-align:top">${esc(r.caracteristica)}</td>
        <td style="padding:4px 0;font-weight:600;vertical-align:top">${esc([r.valor, r.unidade].filter(Boolean).join(' '))}</td>
      </tr>`).join('');

    const propsRows = composicao.map((r, i) => `
      <tr style="border-bottom:1px solid #E4E6E9;background:${i % 2 === 1 ? '#F5F6F7' : 'transparent'}">
        <td style="padding:5px 9px;vertical-align:top;color:#3A3F46">${esc(r.item)}</td>
        <td style="padding:5px 9px;vertical-align:top;white-space:pre-line">${esc(r.unidade)}</td>
        <td style="padding:5px 9px;vertical-align:top;font-weight:600;white-space:pre-line">${esc(r.valor)}</td>
      </tr>`).join('');

    const liItems = (arr) => arr.map(item => `<li>${esc(item)}</li>`).join('');

    const logoSrc = customLogo || defaultLogoBase64;
    const subtituloTexto = selectedProduct.subtitulo || selectedProduct.category || '';

    const pagina1 = `
    <section class="page" style="position:relative;padding:12mm 13mm 18mm;font-family:Barlow,'Helvetica Neue',Arial,sans-serif;color:#111111;background:#ffffff;box-sizing:border-box;min-height:297mm">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px">
        <img src="${logoSrc}" alt="Kalenborn Wear Protection Solutions" style="height:16mm;width:auto;display:block">
        <div style="text-align:right;line-height:1">
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:23pt;letter-spacing:.02em;color:#1B3A6B">FICHA TÉCNICA</div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:500;font-size:11.5pt;letter-spacing:.14em;color:#8A9099;margin-top:3px">TECHNICAL DATA SHEET</div>
        </div>
      </div>

      <div style="height:3px;background:#111111;margin:7px 0 0"></div>
      <div style="height:3px;background:#FFD200;margin:2px 0 10px"></div>

      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:9px">
        <h1 style="margin:0;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:21pt;letter-spacing:.01em">${esc(nomeExibicao)}</h1>
        <div style="font-size:9.5pt;color:#6B7280;white-space:nowrap">${esc(subtituloTexto)}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(${mostrarCodVale ? 4 : 3},1fr);gap:1px;background:#C9CDD3;border:1px solid #C9CDD3;margin-bottom:11px">
        ${mostrarCodVale ? `<div style="background:#F5F6F7;padding:5px 8px"><div style="font-size:7.5pt;letter-spacing:.08em;color:#6B7280;text-transform:uppercase">Cód. Vale</div><div style="font-size:11pt;font-weight:600">${esc(selectedProduct.codvale || '—')}</div></div>` : ''}
        <div style="background:#F5F6F7;padding:5px 8px"><div style="font-size:7.5pt;letter-spacing:.08em;color:#6B7280;text-transform:uppercase">Cód. Kalenborn</div><div style="font-size:11pt;font-weight:600">${esc(selectedProduct.codkalenborn || selectedProduct.id || '—')}</div></div>
        <div style="background:#F5F6F7;padding:5px 8px"><div style="font-size:7.5pt;letter-spacing:.08em;color:#6B7280;text-transform:uppercase">NCM</div><div style="font-size:11pt;font-weight:600">${esc(selectedProduct.ncm || '—')}</div></div>
        <div style="background:#F5F6F7;padding:5px 8px"><div style="font-size:7.5pt;letter-spacing:.08em;color:#6B7280;text-transform:uppercase">Unidade</div><div style="font-size:11pt;font-weight:600">${esc(selectedProduct.um || 'UN')}</div></div>
      </div>

      <div style="display:grid;grid-template-columns:74mm 1fr;gap:8mm;align-items:start">
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="border:1px solid #C9CDD3;background:#FBFBFC;padding:4px">
            <div style="width:100%;height:66mm;display:flex;align-items:center;justify-content:center;overflow:hidden">${imgProduto}</div>
          </div>
          <div style="font-size:8pt;color:#6B7280;line-height:1.35">Figura 1 — Vista isométrica do produto.</div>
          ${camadasHtml}
        </div>

        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5pt;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid #111111;padding-bottom:3px;margin-bottom:7px">Descrição<span style="color:#8A9099;font-weight:500"> / Description</span></div>
          <p style="margin:0;font-size:10.5pt;line-height:1.45;text-align:justify">${boldKeywords(selectedProduct.caracteristica || selectedProduct.descricao_original || 'Sem descrição cadastrada.')}</p>

          ${propriedades.length > 0 ? `
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5pt;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid #111111;padding-bottom:3px;margin:13px 0 0">Características<span style="color:#8A9099;font-weight:500"> / Features</span></div>
          <table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:4px">
            <tbody>${featuresRows}</tbody>
          </table>` : ''}
        </div>
      </div>

      <div style="position:absolute;left:13mm;right:13mm;bottom:8mm;border-top:1px solid #C9CDD3;padding-top:5px;display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;color:#6B7280;line-height:1.3">
        <div><strong style="color:#111111">KALENBORN DO BRASIL LTDA</strong> · Estrada Antiga BH — Pedro Leopoldo, 1150, Galpão 03 · Vespasiano / MG<br>+55 31 3499-4000 · comercial@kalenborn.com.br · www.kalenborn.com.br</div>
        <div style="text-align:right;white-space:nowrap">Página 1 de 2</div>
      </div>
    </section>`;

    const pagina2 = `
    <section class="page" style="position:relative;padding:12mm 13mm 18mm;font-family:Barlow,'Helvetica Neue',Arial,sans-serif;color:#111111;background:#ffffff;box-sizing:border-box;min-height:297mm;page-break-before:always">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111111;padding-bottom:6px;margin-bottom:11px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14pt;letter-spacing:.04em">${esc(nomeExibicao)}</div>
        <div style="font-size:8.5pt;color:#6B7280;letter-spacing:.1em;text-transform:uppercase">Ficha Técnica${mostrarCodVale ? ` · Cód. Vale ${esc(selectedProduct.codvale || '—')}` : ''}</div>
      </div>

      ${composicao.length > 0 ? `
      <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5pt;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px">Propriedades do produto<span style="color:#8A9099;font-weight:500"> / Product properties</span></div>
      ${selectedProduct.propriedades_subtitulo ? `<div style="font-size:8.5pt;color:#6B7280;margin-bottom:6px">${esc(selectedProduct.propriedades_subtitulo)}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:9.5pt;border:1px solid #C9CDD3">
        <thead>
          <tr style="background:#111111;color:#ffffff">
            <th style="text-align:left;padding:6px 9px;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:10.5pt;letter-spacing:.06em;text-transform:uppercase;width:44%">Característica</th>
            <th style="text-align:left;padding:6px 9px;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:10.5pt;letter-spacing:.06em;text-transform:uppercase;width:34%">Unidade</th>
            <th style="text-align:left;padding:6px 9px;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:10.5pt;letter-spacing:.06em;text-transform:uppercase;width:22%">Valor</th>
          </tr>
        </thead>
        <tbody>${propsRows}</tbody>
      </table>
      <div style="font-size:7.5pt;color:#8A9099;margin-top:4px;line-height:1.35">Valores típicos de laboratório, não constituem especificação de fornecimento.</div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:11px">
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5pt;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid #111111;padding-bottom:3px;margin-bottom:6px">Aplicação recomendada<span style="color:#8A9099;font-weight:500"> / Application</span></div>
          <ul style="margin:0;padding-left:15px;font-size:9.5pt;line-height:1.45;display:flex;flex-direction:column;gap:3px">${liItems(aplicacao)}</ul>
        </div>
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12.5pt;letter-spacing:.08em;text-transform:uppercase;border-bottom:2px solid #111111;padding-bottom:3px;margin-bottom:6px">Instruções de montagem<span style="color:#8A9099;font-weight:500"> / Mounting</span></div>
          <ol style="margin:0;padding-left:16px;font-size:9.5pt;line-height:1.45;display:flex;flex-direction:column;gap:3px">${liItems(montagem)}</ol>
        </div>
      </div>

      <div style="margin-top:11px;border:1px solid #C9CDD3;border-left:3px solid #FFD200;background:#FAFAF6;padding:8px 11px">
        <div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11.5pt;letter-spacing:.07em;text-transform:uppercase;margin-bottom:4px">Observações<span style="color:#8A9099;font-weight:500"> / Notes</span></div>
        <ul style="margin:0;padding-left:15px;font-size:9pt;line-height:1.4;display:flex;flex-direction:column;gap:2px;color:#3A3F46">${liItems(observ)}</ul>
      </div>

      ${selectedProduct.garantia ? `<div style="font-size:9pt;color:#6B7280;margin-top:11px"><strong style="color:#111111">Garantia:</strong> ${esc(selectedProduct.garantia)}</div>` : ''}

      <div style="position:absolute;left:13mm;right:13mm;bottom:8mm;border-top:1px solid #C9CDD3;padding-top:5px;display:flex;justify-content:space-between;align-items:center;font-size:7.5pt;color:#6B7280;line-height:1.3">
        <div><strong style="color:#111111">KALENBORN DO BRASIL LTDA</strong> · Estrada Antiga BH — Pedro Leopoldo, 1150, Galpão 03 · Vespasiano / MG<br>+55 31 3499-4000 · comercial@kalenborn.com.br · www.kalenborn.com.br</div>
        <div style="text-align:right;white-space:nowrap">Página 2 de 2</div>
      </div>
    </section>`;

    const separadorTela = `<div data-html2canvas-ignore="true" style="position:relative;height:0;border-top:2px dashed #94A3B8;margin:4px 0"><span style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 12px;font-size:9px;font-weight:700;letter-spacing:.08em;color:#64748B;text-transform:uppercase;white-space:nowrap">Fim da página 1 · Início da página 2</span></div>`;

    return <div dangerouslySetInnerHTML={{ __html: pagina1 + separadorTela + pagina2 }} />;
  };

  return (
    <div className="flex h-full w-full bg-slate-100 overflow-hidden relative">
      <div className={`bg-white flex flex-col h-full shadow-2xl z-40 shrink-0 transition-all duration-500 ${isListVisible ? 'w-full lg:w-[350px] translate-x-0 border-r border-slate-200' : 'w-0 -translate-x-full border-none overflow-hidden'}`}>
        <div className="w-full lg:w-[350px] flex flex-col h-full">
          <div className="p-5 border-b bg-slate-50"><h2 className="font-black text-slate-800 text-lg uppercase flex items-center gap-2"><Layers size={20} className="text-blue-600" /> Fichas Técnicas</h2><p className="text-xs text-slate-500 mt-1">Gere PDFs de bandejas e produtos.</p></div>
          <div className="p-4 border-b bg-white"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Buscar peça..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" /></div></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filtered.map(p => (<button key={p.id} onClick={() => { setSelectedId(p.id); if(window.innerWidth < 1024) setIsListVisible(false); }} className={`w-full text-left p-3 rounded-lg mb-1 transition-colors touch-manipulation ${selectedId === p.id ? 'bg-blue-50 border-blue-200 border text-blue-800' : 'hover:bg-slate-50 border border-transparent text-slate-600'}`}><div className="font-bold text-xs line-clamp-1">{p.name || p.codKalenborn}</div><div className="text-[10px] text-slate-400 mt-1">Vale: {p.codvale || 'N/A'} | KBN: {p.id}</div></button>))}
            {filtered.length === 0 && <div className="text-center p-4 text-xs text-slate-400">Nenhuma peça encontrada.</div>}
          </div>
        </div>
      </div>
      <button onClick={() => setIsListVisible(!isListVisible)} className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-[60] bg-white border border-slate-200 shadow-2xl h-14 w-8 items-center justify-center rounded-r-2xl text-slate-400 hover:text-blue-600 transition-all duration-500 cursor-pointer" style={{ left: isListVisible ? '350px' : '0px' }}>{isListVisible ? <ChevronLeft size={20}/> : <ChevronRight size={20}/>}</button>
      <div className="flex-1 flex flex-col items-center overflow-auto p-8 custom-scrollbar bg-slate-200 relative z-10">
        {selectedProduct ? (
          <>
            <div className="w-full max-w-[210mm] flex items-center justify-between mb-4 gap-3">
              <button onClick={() => setIsListVisible(true)} className="lg:hidden bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2.5 px-4 rounded-lg shadow-sm flex items-center gap-2 cursor-pointer"><ChevronLeft size={18} /> Voltar</button>
              <label className="hidden sm:flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm cursor-pointer select-none">
                <input type="checkbox" checked={mostrarCodVale} onChange={e => setMostrarCodVale(e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                <span className="text-xs font-bold text-slate-600">Mostrar Cód. Vale</span>
              </label>
              <button onClick={handleDownload} disabled={isGenerating} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer ml-auto">{isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />} Baixar PDF</button>
            </div>
            <div className="bg-white shadow-2xl mb-10 shrink-0 box-border" style={{ width: '210mm' }} id="ficha-tecnica-pdf-real">{renderFicha()}</div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400"><Layers size={48} className="mb-4 opacity-50" /><p>Selecione uma peça na lista.</p></div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================
function SettingsView({ showToast, setCustomLogo, currentLogo, refreshData, openAIApiKey, setOpenAIApiKey }) {
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showToast("Salvando Logo...");
    try { const publicUrl = await supabaseUpload('portal-files', 'branding/logo_main.png', file); setCustomLogo(publicUrl); localStorage.setItem('kalenborn_logo', publicUrl); await supabaseRequest('settings', 'POST', { id: 'logo', value: publicUrl }, true); showToast("✅ Logo Atualizada!"); refreshData(); } catch (err) { showToast("Erro ao salvar logo."); }
  };
  const handleSaveApiKey = async () => {
    showToast("Salvando chave...");
    try { await supabaseRequest('settings', 'POST', { id: 'openai_key', value: openAIApiKey }, true); localStorage.setItem('kalenborn_openai_key', openAIApiKey); showToast("✅ Chave salva!"); refreshData(); } catch (err) { showToast("Erro."); }
  };
  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-10 h-full overflow-y-auto custom-scrollbar font-sans text-left">
       <h1 className="text-3xl font-black text-slate-800 uppercase tracking-widest border-b pb-4">Ajustes do Sistema</h1>
       <div className="bg-purple-50 p-6 sm:p-8 rounded-[2rem] border border-purple-200 shadow-sm mb-6"><h2 className="text-lg font-black mb-2 text-purple-900 flex items-center gap-2"><Bot size={24}/> Inteligência Artificial</h2><p className="text-sm text-purple-700 mb-6 font-medium">Configure a chave da API para ativar o cálculo fiscal inteligente.</p><div className="relative mb-4"><input type="password" value={openAIApiKey} onChange={(e) => setOpenAIApiKey(e.target.value)} placeholder="sk-proj-..." className="w-full pl-6 pr-10 py-4 rounded-xl border border-purple-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono shadow-inner bg-white shadow-purple-900/5" /><Key size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400" /></div><button onClick={handleSaveApiKey} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-purple-700 transition-all shadow-lg cursor-pointer">Salvar Chave API</button></div>
       <div className="bg-white p-6 sm:p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-12 justify-center"><div className="h-40 w-full md:w-80 border-2 border-slate-100 bg-slate-50/50 rounded-[2rem] flex items-center justify-center p-8 shadow-inner"><img src={currentLogo || defaultLogoBase64} alt="Logo" className="max-h-full max-w-full object-contain filter drop-shadow-md" /></div><label className="bg-[#0F172A] text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-600 transition-all shadow-xl flex items-center gap-2"><FileUp size={16}/> Alterar Logo no Banco<input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" /></label></div>
    </div>
  );
}
