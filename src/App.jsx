import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  FileSignature, PenTool, Search, PieChart, Settings, LogOut, 
  Menu, X, Save, FileText, Plus, Trash2, Building, Receipt, 
  Bot, Download, CheckCircle, AlertTriangle, FileUp, Globe,
  Handshake, Clock, FileWarning, Key, Box, Camera, Ruler, 
  Info, Grid, Wrench, Video, Layers, Minimize2, Maximize2, 
  RefreshCw, Move, ChevronLeft, ChevronRight, Edit, ChevronDown
} from 'lucide-react';

/**
 * CONFIGURAÇÕES DE CONEXÃO - SUPABASE
 */
const SUPABASE_URL = "https://iwpsxftmwbsvjdktlidk.supabase.co/";
const SUPABASE_REST_URL = "https://iwpsxftmwbsvjdktlidk.supabase.co/rest/v1/";
const SUPABASE_AUTH_URL = "https://iwpsxftmwbsvjdktlidk.supabase.co/auth/v1/";
const SUPABASE_KEY = "sb_publishable_KCGnYnt31h45QuNhHLFvxA_0MuQAaq6";

const defaultLogoBase64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMjAiIGhlaWdodD0iNjAiPjxyZWN0IHdpZHRoPSIyMjAiIGhlaWdodD0iNjAiIGZpbGw9IiNmZmZmZmYiLz48dGV4dCB4PSIxMCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMxNDMyNWEiPkthbGVuYm9ybjwvdGV4dD48L3N2Zz4=";

// --- Motor de API Supabase ---
async function supabaseRequest(table, method = 'GET', body = null, merge = false) {
  const token = localStorage.getItem('kbn_supabase_token') || SUPABASE_KEY;
  const headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  if (merge && method === 'POST') headers["Prefer"] = "resolution=merge-duplicates";
  else headers["Prefer"] = "return=representation";
  
  let url = `${SUPABASE_REST_URL}${table}`;
  const options = { method, headers };

  if (method === 'PATCH' && body?.id) {
     url = `${SUPABASE_REST_URL}${table}?id=eq.${body.id}`;
     const cleanBody = { ...body };
     delete cleanBody.id;
     options.body = JSON.stringify(cleanBody);
  } else if (body) {
     options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) throw new Error(await response.text());
  
  // Tratamento vital para evitar erro em respostas "204 No Content" do Supabase
  if (method === 'DELETE' || response.status === 204 || response.status === 201) return {};
  
  const responseText = await response.text();
  try {
     return responseText ? JSON.parse(responseText) : {};
  } catch (e) {
     return {};
  }
}

async function supabaseUpload(bucket, path, file) {
  const token = localStorage.getItem('kbn_supabase_token') || SUPABASE_KEY;
  const url = `${SUPABASE_URL}storage/v1/object/${bucket}/${path}`;
  const response = await fetch(url, {
      method: 'POST',
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": file.type || 'application/pdf' },
      body: file
  });
  if (!response.ok) {
      const err = await response.json();
      if (err.error === "Duplicate") return `${SUPABASE_URL}storage/v1/object/public/${bucket}/${path}`;
      throw new Error(`Erro Upload: ${err.message}`);
  }
  return `${SUPABASE_URL}storage/v1/object/public/${bucket}/${path}`;
}

// ==========================================
// FUNÇÕES AUXILIARES GLOBAIS E CÁLCULO TRIBUTÁRIO
// ==========================================
const formatCNPJ = (c) => {
  if (!c) return '';
  const clean = String(c).replace(/\D/g, '');
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const formatNum = (v) => {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
};

const getAutoIcms = (address, codOrigem) => {
  if (!address) return '18%'; 
  const upperAddress = address.toUpperCase();
  const isMG = /\b(MG|MINAS GERAIS)\b/.test(upperAddress) || upperAddress.includes('-MG') || upperAddress.includes('/MG');
  
  if (isMG) return '18%';

  const isImported = ['1', '2', '3', '8'].includes(String(codOrigem).trim());
  if (isImported) return '4%';

  const sudesteSul = ['SP', 'SÃO PAULO', 'SAO PAULO', 'RJ', 'RIO DE JANEIRO', 'PR', 'PARANÁ', 'PARANA', 'SC', 'SANTA CATARINA', 'RS', 'RIO GRANDE DO SUL'];
  if (sudesteSul.some(state => upperAddress.includes(` ${state}`) || upperAddress.includes(`-${state}`) || upperAddress.includes(`/${state}`))) return '12%';
  
  return '7%'; 
};

const resolveClientIcms = (client, codOrigem, defaultIcms = '18%') => {
  if (!client) return defaultIcms;
  if (client.icms !== undefined && client.icms !== null && client.icms !== '') {
      return String(client.icms).includes('%') ? String(client.icms) : `${client.icms}%`;
  }
  return getAutoIcms(client.address, codOrigem);
};

const calculateGrossPrice = (liquidPrice, icmsString, pisCofinsString) => {
  const icms = parseFloat(String(icmsString).replace('%', '')) || 0;
  const pisCofins = parseFloat(String(pisCofinsString).replace('%', '')) || 0; 
  const totalTaxes = (icms + pisCofins) / 100;
  if (totalTaxes >= 1) return liquidPrice;
  return liquidPrice / (1 - totalTaxes);
};

const calculateProposalTotals = (items, descontoPct) => {
  let subtotalBrutoSemIpi = 0;
  let totalIpi = 0;
  let subtotalLiquido = 0;
  
  items.forEach(it => {
    const gross = calculateGrossPrice(it.price, it.icms, it.pisCofins);
    const ipi = parseFloat(it.ipi || 0);
    const itemTotalBruto = gross * it.quantity;
    const itemIpiVal = itemTotalBruto * (ipi / 100);
    
    subtotalBrutoSemIpi += itemTotalBruto;
    totalIpi += itemIpiVal;
    subtotalLiquido += (it.price * it.quantity);
  });
  
  const desc = parseFloat(descontoPct) || 0;
  const valorDesconto = subtotalBrutoSemIpi * (desc / 100);
  const totalFinal = (subtotalBrutoSemIpi - valorDesconto) + totalIpi;

  return { subtotalBruto: subtotalBrutoSemIpi, subtotalLiquido, totalIpi, total: totalFinal, valorDesconto };
};

const getEmptyProposal = () => {
  const user = localStorage.getItem('kbn_user') || 'Comercial';
  const userName = user.charAt(0).toUpperCase() + user.slice(1);
  return {
    id: '', numeroUnico: '', status: 'Pendente', clientId: '', items: [],
    attachment_url: null,
    config: { projeto: 'Gerado Automático', date: new Date().toLocaleDateString('pt-BR'), emissor: userName, vendedor: user, contato: '', referencia: '', observacoesAdicionais: '', condicaoPagamento: '30 Dias', transporte: 'CIF', naturezaOperacao: 'Venda para Consumo', desconto: 0, icmsDestino: '18%' },
    total: 0
  };
};

async function askChatGPT(prompt, apiKey, expectJson = false) {
  if (!apiKey) throw new Error("Chave API ausente.");
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
        model: 'gpt-4o-mini', 
        messages: [{ role: 'user', content: prompt }],
        ...(expectJson && { response_format: { type: "json_object" } })
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

// ==========================================
// BANCO DE DADOS DO SIMULADOR 3D E FICHA TÉCNICA
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

            const gridSize = 7;
            const w = 5.0;
            const h = 5.0;
            const gap = 0.5; 
            const startX = -16.5; 
            const startY = 16.5; 
            
            for (let row = 0; row < gridSize; row++) {
                let centerY = startY - row * (h + gap);
                for (let col = 0; col < gridSize; col++) {
                    let centerX = startX + col * (w + gap);
                    p.push({ 
                        name: `Ceramica_${row}_${col}`, 
                        type: 'box', 
                        size: [w, h, 5.0], 
                        pos: [centerX, centerY, 3.8], 
                        explodedPos: [centerX, centerY, 15], 
                        color: 0xffffff 
                    });
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

            const gap = 0.2;
            const w = 4.65; 
            const hFull = 4.8; 
            const hSmall = 3.8;
            const zCeramica = 2.5; 
            const zExploded = 15;

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
                    
                    p.push({ 
                        name: `Ceramica_${col}_${row}_${labels[row]}`, 
                        type: 'box', 
                        size: [w, h, 5.0], 
                        pos: [centerX, centerY, zCeramica], 
                        explodedPos: [centerX, centerY, zExploded], 
                        color: 0xffffff 
                    });
                    
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

            const magX = [-4.5, 4.5];
            const magY = [13.5, 4.5, -4.5, -13.5];
            magX.forEach((mx, i) => {
                magY.forEach((my, j) => {
                    p.push({
                        name: `Ima_${i}_${j}`, 
                        type: 'box', 
                        size: [4, 4, 1.5], 
                        pos: [mx, my, -0.65], 
                        explodedPos: [mx, my, -25], 
                        color: 0x64748b 
                    });
                });
            });

            const cols = 4;
            const rows = 8;
            const gap = 0.2; 
            const w = (18.6 - (cols - 1) * gap) / cols;
            const h = (38.6 - (rows - 1) * gap) / rows;
            let startX = -9.3 + (w / 2); 
            let startY = 19.3 - (h / 2); 
            
            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    let label = '1.2';
                    if (c === 0 && r === 7) label = '1.3';
                    if (c === 1 && r === 0) label = '1.3';
                    if (c === 2 && r === 7) label = '1.3';
                    if (c === 3 && r === 0) label = '1.3';

                    p.push({ 
                        name: `Ceramica_${c}_${r}_${label}`, 
                        type: 'box', 
                        size: [w, h, 5.4],
                        pos: [startX + c*(w+gap), startY - r*(h+gap), 2.7], 
                        explodedPos: [startX + c*(w+gap), startY - r*(h+gap), 15], 
                        color: 0xffffff 
                    });
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

            const w = 4.4;
            const gapX = 0.31; 
            const gapY = 0.22; 
            const zCeramica = 2.25; 
            const zExploded = 15;
            let startX = -16.485; 

            for (let col = 0; col < 8; col++) {
                let currentX = startX + col * (w + gapX);
                let isSmallTop = (col % 2 === 0);
                let pieces = isSmallTop 
                    ? [2.2, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4]
                    : [4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 2.2];

                let currentYTop = 24.2; 
                for (let row = 0; row < pieces.length; row++) {
                    let pHeight = pieces[row];
                    let centerY = currentYTop - (pHeight / 2);
                    p.push({ 
                        name: `Ceramica_${col}_${row}`, 
                        type: 'box', 
                        size: [w, pHeight, 2.5], 
                        pos: [currentX, centerY, zCeramica], 
                        explodedPos: [currentX, centerY, zExploded], 
                        color: 0xffffff 
                    });
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

/**
 * Gestor do Motor 3D encapsulado para funcionar nativamente dentro do React.
 */
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
        
        dirLight.shadow.camera.left = -100;
        dirLight.shadow.camera.right = 100;
        dirLight.shadow.camera.top = 100;
        dirLight.shadow.camera.bottom = -100;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xa5f3fc, 0.6);
        backLight.position.set(-50, 20, -50);
        this.scene.add(backLight);

        const gridHelper = new THREE.GridHelper(150, 30, 0xbae6fd, 0xe2e8f0);
        gridHelper.position.y = -30;
        gridHelper.material.opacity = 0.5;
        gridHelper.material.transparent = true;
        this.scene.add(gridHelper);

        const floorGeo = new THREE.PlaneGeometry(500, 500);
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.15 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -50;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.modelGroup = new THREE.Group();
        this.rubberGroup = new THREE.Group();
        this.cadLinesGroup = new THREE.Group();
        
        this.scene.add(this.modelGroup);
        this.scene.add(this.cadLinesGroup);
    }

    bindEvents() {
        this.resizeHandler = () => {
            if(!this.container) return;
            const rect = this.container.getBoundingClientRect();
            this.camera.aspect = rect.width / rect.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(rect.width, rect.height);
        };
        window.addEventListener('resize', this.resizeHandler);
    }

    clearScene() {
        while(this.modelGroup.children.length > 0) this.modelGroup.remove(this.modelGroup.children[0]); 
        while(this.cadLinesGroup.children.length > 0) this.cadLinesGroup.remove(this.cadLinesGroup.children[0]); 
        this.rubberGroup = new THREE.Group();
        this.animationParts = [];
        this.labelsContainer.innerHTML = '';
        this.htmlLabels = [];
    }

    loadProject(project, rubberActive) {
        this.clearScene();
        this.rubberGroup.visible = rubberActive;

        const materialNormal = new THREE.MeshStandardMaterial({ color: 0x8892b0, metalness: 0.7, roughness: 0.4, wireframe: this.isWireframe });
        const materialScrew = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2, wireframe: this.isWireframe });
        const materialFabric = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.0, roughness: 0.9, wireframe: this.isWireframe });

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        let validPartsCount = 0;

        project.parts.forEach(part => {
            let geometry;
            let mat = materialNormal;
            
            const isCeramic = part.name.includes('Ceramica') || part.color === 0xffffff || part.name.startsWith('C_');
            const isRubber = part.name.includes('Borracha') || part.name.includes('Base_Fundo') || part.name.includes('Ima');

            if (part.type === 'box') {
                geometry = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
                if (part.color) {
                    let mMetalness = 0.7, mRoughness = 0.4, mEmissive = 0x000000;
                    if (isCeramic) { 
                        mMetalness = 0.0; 
                        mRoughness = 1.0; 
                        mEmissive = 0x555555; 
                    } 
                    else if (isRubber) { 
                        mMetalness = 0.05; 
                        mRoughness = 0.95; 
                    }
                    mat = new THREE.MeshStandardMaterial({ color: part.color, emissive: mEmissive, metalness: mMetalness, roughness: mRoughness, wireframe: this.isWireframe });
                }
                if (part.isFabric) mat = materialFabric; 
            } else if (part.type === 'cylinder' || part.type === 'cylinder_hole') {
                geometry = new THREE.CylinderGeometry(part.radius, part.radius, part.height, 32);
                mat = (part.type === 'cylinder_hole') ? new THREE.MeshBasicMaterial({color: 0x000000, wireframe: this.isWireframe}) : materialScrew;
            }

            if (geometry) {
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
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

                this.animationParts.push({ mesh: mesh, assembledPos: new THREE.Vector3(part.pos[0], part.pos[1], part.pos[2]), explodedPos: new THREE.Vector3(part.explodedPos[0], part.explodedPos[1], part.explodedPos[2]) });

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
                this.animationParts.push({ mesh: mesh, assembledPos: new THREE.Vector3(px, py, pz), explodedPos: new THREE.Vector3(px + dx, py + dy, pz - 10) });
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
            
            div.style.position = 'absolute';
            div.style.color = '#0284c7';
            div.style.fontSize = '0.75rem';
            div.style.fontWeight = '600';
            div.style.fontFamily = 'monospace';
            div.style.background = 'rgba(255, 255, 255, 0.85)';
            div.style.padding = '2px 6px';
            div.style.border = '1px solid rgba(2, 132, 199, 0.3)';
            div.style.borderRadius = '4px';
            div.style.pointerEvents = 'none';
            div.style.transform = 'translate(-50%, -50%)';
            div.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
            
            div.innerHTML = m.text;
            this.labelsContainer.appendChild(div);
            this.htmlLabels.push({ element: div, pos3D: pos3D });
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
        if(this.container) this.container.innerHTML = '';
        if(this.labelsContainer) this.labelsContainer.innerHTML = '';
    }
}

// ==========================================
// COMPONENTE DE LOGIN TOTALMENTE LIMPO (VIA TABELA portal_usuarios)
// ==========================================
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!username || !password) {
      setError("Preencha o nome de usuário e a senha.");
      setLoading(false);
      return;
    }

    let firstName = username.trim().split(' ')[0].toLowerCase();
    if (firstName.includes('@')) {
      firstName = firstName.split('@')[0];
    }

    try {
      const res = await fetch(`${SUPABASE_REST_URL}portal_usuarios?usuario=eq.${firstName}&senha=eq.${password}`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}` 
        }
      });

      const data = await res.json();
      
      if (!res.ok || !data || data.length === 0) {
        throw new Error('Falha na autenticação.');
      }
      
      localStorage.setItem('kbn_auth', 'true');
      localStorage.setItem('kbn_user', firstName);
      onLogin();

    } catch (err) { 
      setError("Nome de usuário ou senha incorretos."); 
    } finally {
      setLoading(false);
    }
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
// COMPONENTE PRINCIPAL (APP)
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
  const [customLogo, setCustomLogo] = useState(defaultLogoBase64);
  const [openAIApiKey, setOpenAIApiKey] = useState(localStorage.getItem('kalenborn_openai_key') || '');

  const [currentProposal, setCurrentProposal] = useState(getEmptyProposal());

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 4000); };

  const refreshData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabaseRequest('clients?select=*&order=company.asc'),
        supabaseRequest('products?select=*&order=name.asc'),
        supabaseRequest('observations?select=*'),
        supabaseRequest('proposals?select=*&order=created_at.desc'),
        supabaseRequest('settings?select=*')
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
    } catch (e) { showToast("Erro ao carregar dados."); }
    finally { setLoading(false); }
  };

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
    } catch (error) {
      showToast("Erro ao excluir proposta.");
    }
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
          <NavItem icon={Box} label="Bandejas 3D" active={activeTab === 'simulator'} onClick={() => { setActiveTab('simulator'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <NavItem icon={Layers} label="Ficha Técnica" active={activeTab === 'technicalSheet'} onClick={() => { setActiveTab('technicalSheet'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
        </nav>
        <div className="p-4 border-t border-white/5 bg-[#0B1120]/50 space-y-3 shrink-0">
          <NavItem icon={Settings} label="Configurações" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); if(window.innerWidth < 1024) setIsSidebarExpanded(false); }} collapsed={!isSidebarExpanded} />
          <button onClick={() => { setIsAuthenticated(false); localStorage.removeItem('kbn_auth'); localStorage.removeItem('kbn_user'); }} className="w-full flex items-center p-3.5 rounded-xl transition-all text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 group cursor-pointer"><LogOut size={20} className="lg:w-6" /><span className={`font-bold text-xs uppercase tracking-widest transition-all duration-300 ${!isSidebarExpanded && 'lg:hidden'}`}>Sair</span></button>
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
            {activeTab === 'simulator' && <SimulatorView />}
            {activeTab === 'technicalSheet' && <TechnicalSheetView products={products} customLogo={customLogo} showToast={showToast} initialSelectedId={selectedTechSheetId} />}
            {activeTab === 'settings' && <SettingsView showToast={showToast} setCustomLogo={setCustomLogo} currentLogo={customLogo} refreshData={refreshData} openAIApiKey={openAIApiKey} setOpenAIApiKey={setOpenAIApiKey} />}
          </div>
        )}
      </main>
      {toastMessage && <div className="fixed top-6 right-6 z-[100] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 font-bold text-sm animate-in fade-in slide-in-from-top-4 flex items-center gap-3"><CheckCircle size={18} className="text-emerald-400" /> {toastMessage}</div>}
      <style>{`.cad-label { position: absolute; color: #0284c7; font-size: 0.75rem; font-weight: 600; font-family: monospace; background: rgba(255, 255, 255, 0.85); padding: 2px 6px; border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 4px; pointer-events: none; transform: translate(-50%, -50%); white-space: nowrap; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); transition: opacity 0.3s ease; } .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; } .pdf-preview-wrapper { transform-origin: top center; transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); margin: 0 auto;} .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .touch-manipulation { touch-action: manipulation; }`}</style>
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
// ABA 1: CATÁLOGO
// ==========================================
function CatalogView({ clients, products, currentProposal, setCurrentProposal, showToast, apiKey, setActiveTab, logo }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchingAI, setIsSearchingAI] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const [addModalProd, setAddModalProd] = useState(null);
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState(0);

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
    } catch (error) { console.error(error); showToast("Erro ao consultar a IA."); } finally { setIsSearchingAI(false); }
  };

  const openAddModal = (prod) => { setAddModalProd(prod); setAddQty(1); setAddPrice(prod.price || 0); };
  
  let previewGross = 0; let previewTotal = 0;
  let computedIcms = '18%';

  if (addModalProd) {
    const client = clients.find(c => c.id === currentProposal.clientId);
    computedIcms = currentProposal.clientId ? resolveClientIcms(client, addModalProd.codOrigem, currentProposal.config?.icmsDestino || addModalProd.icms) : (currentProposal.config?.icmsDestino || addModalProd.icms || '18%');
    const pis = addModalProd.pisCofins || '9.25';
    const ipiStr = String(addModalProd.ipi || '0').replace('%', '').trim();
    const ipi = parseFloat(ipiStr) || 0;
    previewGross = calculateGrossPrice(addPrice, computedIcms, pis);
    previewTotal = (previewGross * addQty) * (1 + (ipi / 100));
  }

  const confirmAdd = () => {
    if (!addModalProd) return;
    setCurrentProposal(prev => {
      const nextNum = ((prev.items.length + 1) * 10).toString();
      const client = clients.find(c => c.id === prev.clientId);
      const targetIcms = prev.clientId ? resolveClientIcms(client, addModalProd.codOrigem, prev.config?.icmsDestino || addModalProd.icms) : (prev.config?.icmsDestino || addModalProd.icms || '18%');
      
      const newItem = {
        id: Date.now().toString(), productId: addModalProd.id, numeroItem: nextNum, codKalenborn: addModalProd.codKalenborn || addModalProd.name,
        codOrigem: addModalProd.codOrigem || '0', um: addModalProd.um || 'KG', ncm: addModalProd.ncm || 'Consultar', icms: targetIcms, ipi: addModalProd.ipi || '0', pisCofins: addModalProd.pisCofins || '9.25',
        price: parseFloat(addPrice) || 0, quantity: parseFloat(addQty) || 1
      };
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
        <div>
          <img src={logo || defaultLogoBase64} alt="Logótipo da Empresa" className="h-10 sm:h-12 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = defaultLogoBase64; }} />
        </div>
        <div className="relative w-full lg:w-[500px] flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="Ex: Bandeja 390 ou Adesivo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskAI()} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <button onClick={handleAskAI} disabled={isSearchingAI} className="w-full sm:w-auto justify-center bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl shadow-sm font-bold flex items-center gap-2 disabled:opacity-70 cursor-pointer touch-manipulation">
            {isSearchingAI ? <RefreshCw className="animate-spin" size={18}/> : <Bot size={18}/>} <span className="whitespace-nowrap">Perguntar à IA</span>
          </button>
        </div>
      </header>

      {aiMessage && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm relative shrink-0">
          <button onClick={() => { setAiMessage(''); setAiSuggestions([]); }} className="absolute top-3 right-3 text-purple-400 hover:text-purple-700 cursor-pointer touch-manipulation"><X size={20}/></button>
          <div className="flex gap-3 items-start pr-8"><div className="bg-purple-200 p-2 rounded-full shrink-0 text-purple-700"><Bot size={20}/></div><div className="text-sm text-purple-900 leading-relaxed"><strong className="block mb-1">Sugestão:</strong> {aiMessage}</div></div>
          {aiSuggestions.length > 0 && (
            <div className="mt-2 border-t border-purple-200/60 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiSuggestions.map(p => (
                <div key={p.id} className="bg-white border border-purple-200 p-3 rounded-lg flex flex-col justify-between shadow-sm hover:border-purple-400 transition-colors">
                   <div className="mb-3">
                     <div className="font-bold text-slate-800 text-sm mb-1">{p.codKalenborn || p.name}</div>
                     <div className="text-[10px] text-slate-500 flex flex-col gap-0.5">
                       <span>KBN: {p.id}</span>
                       {p.codvale && <span className="text-sky-600 font-semibold">Vale: {p.codvale}</span>}
                       <span>UM: {p.um}</span>
                     </div>
                   </div>
                   <div className="flex items-center justify-between mt-auto">
                     <div className="font-bold text-emerald-600">{p.price === 0 ? 'A cotar' : `R$ ${formatNum(p.price)}`}</div>
                     <button onClick={() => openAddModal(p)} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-600 hover:text-white cursor-pointer touch-manipulation flex items-center gap-1"><Plus size={14}/> Adicionar</button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(aiSuggestions?.length > 0 ? aiSuggestions : filteredProducts).map(p => (
            <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit truncate max-w-[150px]">KBN: {p.id}</span>
                  {p.codvale && <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-1 rounded w-fit truncate max-w-[150px]">Vale: {p.codvale}</span>}
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{p.um}</span>
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2" title={p.codKalenborn || p.name}>{p.codKalenborn || p.name}</h3>
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
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Settings size={18}/> Configurar Item</h3><button onClick={() => setAddModalProd(null)} className="text-blue-200 hover:text-white cursor-pointer touch-manipulation"><X size={20}/></button></div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="font-bold text-slate-800">{addModalProd.codKalenborn || addModalProd.name}</div>
                <div className="text-[10px] text-slate-500 mt-1">NCM: {addModalProd.ncm} | KBN: {addModalProd.id} {addModalProd.codvale ? `| Vale: ${addModalProd.codvale}` : ''}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-600 block mb-1">Quantidade ({addModalProd.um})</label><input type="number" step="0.01" value={addQty} onChange={(e) => setAddQty(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 outline-none text-center font-bold text-lg text-blue-700 bg-blue-50" /></div>
                <div><label className="text-xs font-bold text-slate-600 block mb-1">Preço Unit. (R$)</label><input type="number" step="0.01" value={addPrice} onChange={(e) => setAddPrice(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 outline-none text-center font-bold text-lg text-emerald-700 bg-emerald-50" /></div>
              </div>
              <div className="bg-slate-800 text-white rounded-lg p-3 shadow-inner border border-slate-700">
                <div className="flex justify-between items-center text-xs text-slate-300 mb-1"><span>Bruto Un. c/ Impostos:</span><span>R$ {formatNum(previewGross)}</span></div>
                <div className="text-[9px] text-slate-500 mb-2">ICMS: {computedIcms} | PIS/COF: {addModalProd.pisCofins || '9.25'}% | IPI: {addModalProd.ipi || '0'}%</div>
                <div className="flex justify-between items-center font-bold text-emerald-400 text-sm border-t border-slate-600 pt-2"><span>Total (c/ IPI):</span><span>R$ {formatNum(previewTotal)}</span></div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3 border-t border-slate-200"><button onClick={() => setAddModalProd(null)} className="flex-1 py-2 text-slate-600 font-bold border rounded-lg bg-white cursor-pointer touch-manipulation">Cancelar</button><button onClick={confirmAdd} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg shadow-md flex items-center justify-center gap-2 cursor-pointer touch-manipulation"><CheckCircle size={16}/> Confirmar Item</button></div>
          </div>
        </div>
      )}

      {currentProposal?.items?.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 lg:left-auto lg:right-10 lg:w-[400px] bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-40 border border-slate-700 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl shadow-inner shrink-0">{currentProposal.items.length}</div>
            <div><div className="font-bold text-sm">Item(s) na Proposta</div><div className="text-[10px] text-slate-300 hidden sm:block">Avançe para gerar o PDF</div></div>
          </div>
          <button onClick={() => setActiveTab('builder')} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-md flex items-center gap-2 border border-blue-500 whitespace-nowrap cursor-pointer touch-manipulation">Avançar</button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ABA 2: ELABORADOR E LÓGICA DO PDF OTIMIZADA
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
      if (!isEditorVisible) pdfScale = 0.90;
      else pdfScale = 0.50;
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
     const s = clientSearchText.toLowerCase();
     return (c.company?.toLowerCase().includes(s)) || (c.document?.includes(s));
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
    const autoIcms = currentProposal.clientId ? resolveClientIcms(client, prod.codOrigem, cfg.icmsDestino) : (cfg.icmsDestino || '18%');
    
    const newItem = { id: Date.now().toString(), productId: prod.id, numeroItem: ((items.length + 1) * 10).toString(), codKalenborn: prod.codKalenborn || prod.name, name: prod.name, price: parseFloat(prod.price) || 0, quantity: 1, um: prod.um || 'UN', ncm: prod.ncm || 'Consultar', icms: autoIcms, ipi: prod.ipi || '0', pisCofins: prod.pisCofins || '9.25', codOrigem: prod.codOrigem || '0' };
    setCurrentProposal(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setQuickAddProductId('');
    showToast("Material Adicionado!");
  };

  // Função exclusiva para travar o desconto no máximo em 3%
  const handleDescontoChange = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) {
        updateConfig('desconto', '');
        return;
    }
    if (val > 3) {
        showToast("⚠️ O desconto máximo permitido é de 3%.");
        val = 3;
    } else if (val < 0) {
        val = 0;
    }
    updateConfig('desconto', val);
  };

  const handleGeneratePDFAndUpload = async () => {
    if (!window.html2pdf) return showToast("Aguarde a biblioteca PDF.");
    setIsGeneratingPDF(true);

    if (window.innerWidth < 1024) setMobileTab('preview');

    setTimeout(async () => {
      const scrollContainer = document.getElementById('print-scroll-container');
      if (scrollContainer) {
          scrollContainer.scrollLeft = 0;
          scrollContainer.scrollTop = 0;
      }

      const wrapper = document.querySelector('.pdf-preview-wrapper');
      const originalTransform = wrapper ? wrapper.style.transform : '';
      if (wrapper) {
          wrapper.style.transition = 'none';
          wrapper.style.transform = 'none';
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      const element = document.getElementById('documento-pdf-real');
      if (!element) {
        showToast("Erro: conteúdo do PDF não encontrado.");
        if (wrapper) wrapper.style.transform = originalTransform;
        setIsGeneratingPDF(false);
        return;
      }

      const opt = {
        margin:       0,
        filename:     `Proposta_Kalenborn_${currentProposal?.numeroUnico || 'Comercial'}.pdf`,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { 
          scale: 2, 
          dpi: 300, 
          letterRendering: true, 
          useCORS: true, 
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

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
        } catch (err) {
          console.warn(err);
          showToast("PDF gerado, mas falha ao enviar para a nuvem.");
        }
      } catch (err) {
        console.error(err);
        showToast("Erro ao gerar PDF.");
      } finally {
        if (wrapper) {
            wrapper.style.transform = originalTransform;
            setTimeout(() => { if (wrapper) wrapper.style.transition = 'transform 0.3s ease'; }, 50);
        }
        setIsGeneratingPDF(false);
      }
    }, 500);
  };

  const fieldClass = "w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-sm appearance-none touch-manipulation";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1 text-left";

  const renderPdfLayout = () => (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000000' }}>
       {/* CABEÇALHO CORPORATIVO */}
       <header className="flex justify-between items-start mb-6" style={{ pageBreakInside: 'avoid' }}>
          <div className="w-1/2 flex flex-col">
            <img src={logo || defaultLogoBase64} alt="Kalenborn Logo" className="h-16 object-contain object-left mb-1" style={{ maxWidth: '220px' }} onError={(e) => { e.target.onerror = null; e.target.src = defaultLogoBase64; }} />
          </div>
          <div className="w-1/2 flex justify-end">
             <div className="text-[11px] leading-tight text-left">
                <div className="text-[12px] font-bold mb-1">KALENBORN DO BRASIL LTDA</div>
                <div>Estrada Antiga BH - Pedro Leopoldo, Nº.: 1150 Galpão 03</div>
                <div>Bairro: Fazenda Canavial Velho - Vespasiano / MG</div>
                <div>C.E.P.: 33206-220</div>
                <div>C.N.P.J.: 04.921.141/0001-06 &nbsp;&nbsp;&nbsp; I.E.: 0621852710097</div>
             </div>
          </div>
       </header>

       {/* TÍTULO DA PROPOSTA */}
       <div className="text-center font-bold text-[14px] uppercase my-4 py-1 border-t-2 border-b-2 border-black" style={{ pageBreakInside: 'avoid' }}>
          Proposta Comercial {currentProposal.numeroUnico}
       </div>

       {/* CAIXA DE DADOS DO CLIENTE */}
       <div className="text-[12px] leading-relaxed mb-6" style={{ pageBreakInside: 'avoid' }}>
          <div className="flex justify-between">
            <div><span className="font-bold">Projeto:</span> {cfg.projeto}</div>
            <div><span className="font-bold">Data de Emissão:</span> {cfg.date}</div>
          </div>
          
          <div className="mt-1 flex">
            <div className="w-full"><span className="font-bold">Razão Social:</span> {selectedClient?.company || clientSearchText}</div>
          </div>
          
          <div className="flex">
            <div className="w-1/2 flex"><span className="font-bold mr-1">Endereço:</span> {selectedClient?.address || ''}</div>
            <div className="w-1/2 flex items-center">
              <span className="font-bold whitespace-nowrap mr-1">Contato:</span> 
              <div className="flex-1 ml-1 overflow-hidden">{cfg.contato}</div>
            </div>
          </div>
          
          <div className="flex">
            <div className="w-1/2"><span className="font-bold">CNPJ/CPF:</span> {formatCNPJ(selectedClient?.document || selectedClient?.cnpj)}</div>
            <div className="w-1/2"><span className="font-bold">Telefone:</span> {selectedClient?.phone || ''}</div>
          </div>
          
          <div className="flex">
            <div className="w-1/2"><span className="font-bold">De:</span> {cfg.emissor}</div>
            <div className="w-1/2"><span className="font-bold">Insc. Est.:</span> {selectedClient?.ie || 'Isento'}</div>
          </div>
          
          <div className="mt-1"><span className="font-bold">Referência:</span> {cfg.referencia}</div>
       </div>

       {/* TABELA DE PRODUTOS */}
       <div className="mb-2">
          <table className="w-full text-left border-collapse border border-black" style={{ fontSize: '10px', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gray-200 font-bold" style={{ pageBreakInside: 'avoid' }}>
                <th className="py-1 px-1 border border-black text-center" style={{ width: '4%' }}>Item</th>
                <th className="py-1 px-2 border border-black" style={{ width: '35%' }}>Descrição do Material</th>
                <th className="py-1 px-2 border border-black text-center" style={{ width: '8%' }}>Código Origem</th>
                <th className="py-1 px-1 border border-black text-center" style={{ width: '5%' }}>Qtde</th>
                <th className="py-1 px-1 border border-black text-center" style={{ width: '4%' }}>UN</th>
                <th className="py-1 px-2 border border-black text-right" style={{ width: '15%' }}>Líquido Un.</th>
                <th className="py-1 px-2 border border-black text-right" style={{ width: '15%' }}>Bruto Un.</th>
                <th className="py-1 px-2 border border-black text-right" style={{ width: '20%' }}>Vlr. Total</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {items.length === 0 ? (
                <tr><td colSpan="8" className="p-4 text-center italic text-gray-500 border border-black">Nenhum item adicionado</td></tr>
              ) : (
                items.map((item, index) => {
                  const grossPrice = calculateGrossPrice(item.price, item.icms, item.pisCofins);
                  const ipi = parseFloat(item.ipi) || 0;
                  const totalItem = (grossPrice * item.quantity) * (1 + (ipi / 100));
                  return (
                    <tr key={item.id} style={{ pageBreakInside: 'avoid' }}>
                      <td className="py-1 px-1 border-b border-r border-black text-center font-bold">{item.numeroItem || index + 1}</td>
                      <td className="py-1 px-2 border-b border-r border-black uppercase font-bold" style={{ wordBreak: 'break-word' }}>{item.codKalenborn}</td>
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
              {items.length > 0 && (
                <>
                  <tr className="bg-gray-100 font-bold" style={{ pageBreakInside: 'avoid' }}>
                    <td colSpan="7" className="py-1 px-2 border border-black text-right">Total s/IPI:</td>
                    <td className="py-1 px-2 border border-black text-right font-mono">R$ {formatNum(subtotalBruto)}</td>
                  </tr>
                  {parseFloat(cfg.desconto) > 0 && (
                    <tr className="bg-emerald-50 text-emerald-800 font-bold" style={{ pageBreakInside: 'avoid' }}>
                      <td colSpan="7" className="py-1 px-2 border border-black text-right">DESCONTO APLICADO ({cfg.desconto}%):</td>
                      <td className="py-1 px-2 border border-black text-right font-mono">- R$ {formatNum(valorDesconto)}</td>
                    </tr>
                  )}
                  {totalIpi > 0 && (
                    <tr className="bg-blue-50 text-blue-800 font-bold" style={{ pageBreakInside: 'avoid' }}>
                      <td colSpan="7" className="py-1 px-2 border border-black text-right">Total IPI:</td>
                      <td className="py-1 px-2 border border-black text-right font-mono">+ R$ {formatNum(totalIpi)}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 font-bold text-[12px]" style={{ pageBreakInside: 'avoid' }}>
                    <td colSpan="7" className="py-1 px-2 border border-black text-right uppercase">Total Final:</td>
                    <td className="py-1 px-2 border border-black text-right font-mono">R$ {formatNum(total)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
       </div>

       <div className="text-[10px] mt-1 mb-4 text-black" style={{ pageBreakInside: 'avoid' }}>
          Código de Origem: 0-Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8
       </div>

       <div className="border-t border-black my-4" style={{ pageBreakInside: 'avoid' }}></div>

       <div className="text-[11px] mb-4 space-y-1" style={{ pageBreakInside: 'avoid' }}>
          <div><span className="font-bold">Condição de pagamento:</span> {cfg.condicaoPagamento}</div>
          <div><span className="font-bold">Transporte:</span> {cfg.transporte}</div>
          <div><span className="font-bold">Natureza da Operação:</span> {cfg.naturezaOperacao}</div>
       </div>

       <div className="text-[11px] leading-normal flex-1 mb-8" style={{ pageBreakInside: 'avoid', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
          {cfg.observacoesAdicionais ? (
            <div className="text-justify">{cfg.observacoesAdicionais}</div>
          ) : (
            <div className="text-gray-400 italic text-center p-4 border border-dashed border-gray-300">[ Observações / Condições Comerciais ]</div>
          )}
       </div>

       <footer className="mt-auto pt-2 border-t border-black text-[10px] text-center font-bold" style={{ pageBreakInside: 'avoid' }}>
          <div>Tel.: +55 31 3499-4000 | comercial@kalenborn.com.br | www.kalenborn.com.br</div>
       </footer>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-slate-100 overflow-hidden relative">
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white border-t flex z-50 h-16 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]"><button onClick={()=>setMobileTab('editor')} className={`flex-1 flex items-center justify-center font-black text-xs uppercase tracking-widest transition-colors cursor-pointer touch-manipulation ${mobileTab === 'editor' ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><PenTool size={16} className="mr-2"/> Editor</button><button onClick={()=>setMobileTab('preview')} className={`flex-1 flex items-center justify-center font-black text-xs uppercase tracking-widest transition-colors cursor-pointer touch-manipulation ${mobileTab === 'preview' ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:bg-slate-50'}`}><FileText size={16} className="mr-2"/> PDF</button></div>
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
                 <div className="relative"><input type="text" placeholder="Nome ou CNPJ..." value={clientSearchText} onChange={e=>{setClientSearchText(e.target.value); setShowClientDropdown(true);}} onFocus={()=>setShowClientDropdown(true)} className={fieldClass} /><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /></div>
                 {showClientDropdown && filteredClients.length > 0 && (
                   <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                     {filteredClients.map(c=>(<div key={c.id} onClick={()=>{
                       const fixedIcms = c.icms !== undefined && c.icms !== null && c.icms !== '' ? (String(c.icms).includes('%') ? String(c.icms) : `${c.icms}%`) : null;
                       const targetIcmsDestino = fixedIcms || getAutoIcms(c.address || '', '0');
                       setCurrentProposal(p=>({
                         ...p, 
                         clientId: c.id, 
                         config: { ...p.config, contato: c.contact || 'A/C Comercial', icmsDestino: targetIcmsDestino }, 
                         items: p.items.map(i => ({ ...i, icms: fixedIcms || getAutoIcms(c.address || '', i.codOrigem || '0') }))
                       })); 
                       setClientSearchText(c.company||c.nome); setShowClientDropdown(false); showToast(fixedIcms ? `ICMS fixo do cliente (${fixedIcms}) aplicado!` : `ICMS recalculado automaticamente!`);
                     }} className="p-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer touch-manipulation"><div className="font-bold text-sm text-slate-800">{c.company||c.nome}</div><div className="text-[10px] text-slate-500 mt-1">{formatCNPJ(c.document||c.cnpj)}</div></div>))}
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
              <div><label className={labelClass}>Pagamento</label><div className="relative"><select value={cfg.condicaoPagamento || ''} onChange={e=>updateConfig('condicaoPagamento', e.target.value)} className={`${fieldClass} appearance-none pr-8 cursor-pointer touch-manipulation`}><option value="30 Dias">30 Dias</option><option value="15 Dias">15 Dias</option><option value="À Vista">À Vista</option><option value="Antecipado">Antecipado</option><option value="De acordo com o portal">De acordo com o portal</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/></div></div>
              <div><label className={labelClass}>Transporte</label><div className="relative"><select value={cfg.transporte || ''} onChange={e=>updateConfig('transporte', e.target.value)} className={`${fieldClass} appearance-none pr-8 cursor-pointer touch-manipulation`}><option value="CIF">CIF (Incluso)</option><option value="FOB">FOB (Cliente)</option><option value="EXW">EXW Vespasiano</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/></div></div>
              <div className="col-span-2"><label className={labelClass}>Operação</label><div className="relative"><select value={cfg.naturezaOperacao || ''} onChange={e => updateConfig('naturezaOperacao', e.target.value)} className={`${fieldClass} appearance-none pr-8 cursor-pointer touch-manipulation`}><option value="Venda para Consumo">Consumo Final</option><option value="Venda Industrialização">Industrialização</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12}/></div></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3 border-b pb-2">
               <div className="flex items-center gap-2"><div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg"><FileText size={16}/></div><h4 className="font-black text-[10px] uppercase text-slate-500 tracking-widest">Materiais</h4></div>
               <button onClick={() => setActiveTab('catalog')} className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer touch-manipulation"><Search size={12}/> Catálogo</button>
            </div>
            
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
                    <button onClick={() => removeItem(it.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1.5 bg-slate-50 rounded transition-colors cursor-pointer touch-manipulation"><Trash2 size={14}/></button>
                    <div className="flex gap-2 mb-2 pr-8">
                       <input type="text" value={it.numeroItem || ''} onChange={e=>updateItem(it.id, 'numeroItem', e.target.value)} className="w-8 border-b border-slate-200 text-center font-bold text-xs outline-none focus:border-blue-500 pb-1" title="Item Nº" />
                       <input type="text" value={it.codKalenborn || ''} onChange={e=>updateItem(it.id, 'codKalenborn', e.target.value)} className="flex-1 border-b border-slate-200 font-bold text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-500 pb-1 truncate uppercase" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Qtd</label><input type="number" step="0.01" value={it.quantity || ''} onChange={e=>updateItem(it.id, 'quantity', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center text-blue-600 outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">UN</label><input type="text" value={it.um || ''} onChange={e=>updateItem(it.id, 'um', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Líq (R$)</label><input type="number" step="0.01" value={it.price || ''} onChange={e=>updateItem(it.id, 'price', e.target.value)} className="w-full bg-emerald-50 border border-emerald-100 rounded p-1.5 text-xs font-black text-center text-emerald-700 outline-none" /></div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3 border-t border-slate-50 pt-3">
                      <div>
                        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">ICMS (%)</label>
                        <input type="text" value={it.icms || ''} onChange={e=>updateItem(it.id, 'icms', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" />
                      </div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">PIS/COF</label><input type="text" value={it.pisCofins || ''} onChange={e=>updateItem(it.id, 'pisCofins', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                      <div><label className="text-[8px] font-black text-slate-400 uppercase block mb-1">IPI (%)</label><input type="text" value={it.ipi || ''} onChange={e=>updateItem(it.id, 'ipi', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-black text-center outline-none shadow-inner" /></div>
                    </div>

                    <div className="bg-slate-900 rounded-lg p-2 text-white flex justify-between items-center px-4 shadow-inner border border-slate-800">
                       <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Bruto Unitário: <span className="text-slate-200 ml-1">R$ {formatNum(gp)}</span></div>
                       <div className="text-[10px] font-black text-emerald-400 uppercase">Total: R$ {formatNum(t)}</div>
                    </div>

                    {isTechSheetEligible && (
                      <div className="mt-2 text-right border-t border-slate-100 pt-2">
                        <button onClick={() => { setSelectedTechSheetId(it.productId); setActiveTab('technicalSheet'); }} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer touch-manipulation flex items-center gap-1 justify-end ml-auto">
                          <FileText size={12}/> Abrir Ficha Técnica desta Peça
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {items.length > 0 && (
              <div className="bg-[#0F172A] p-6 rounded-xl shadow-xl mt-6 border border-slate-800 relative overflow-hidden group">
                 <div className="absolute right-0 top-0 w-32 h-32 bg-blue-600/5 rounded-bl-full pointer-events-none group-hover:bg-blue-600/10 transition-all duration-700"></div>
                 
                 <div className="lg:hidden flex justify-between items-center mb-4 relative z-10 border-b border-white/10 pb-4">
                   <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Desc. Comercial (%)</span>
                   <input type="number" step="0.1" max="3" min="0" value={cfg.desconto || 0} onChange={handleDescontoChange} className="w-20 bg-slate-800 border border-slate-600 text-white rounded-lg p-2 text-center text-xs outline-none focus:border-blue-500 shadow-inner" />
                 </div>

                 <div className="flex justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10"><span>Subtotal Bruto (s/IPI):</span><span className="font-mono text-slate-200">R$ {formatNum(subtotalBruto)}</span></div>
                 {parseFloat(cfg.desconto) > 0 && <div className="flex justify-between text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-1 relative z-10"><span>Desconto ({cfg.desconto}%):</span><span className="font-mono">- R$ {formatNum(valorDesconto)}</span></div>}
                 {totalIpi > 0 && <div className="flex justify-between text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4 relative z-10"><span>IPI Total:</span><span className="font-mono">+ R$ {formatNum(totalIpi)}</span></div>}
                 <div className="flex justify-between text-white font-black text-2xl border-t border-white/10 mt-2 pt-4 tracking-tighter uppercase relative z-10"><span>Total Geral:</span><span className="text-emerald-400 font-mono">R$ {formatNum(total)}</span></div>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b pb-2"><div className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><FileWarning size={16}/></div><h4 className="font-bold text-slate-700 text-sm">Observações da Proposta</h4></div>
            <div className="relative mb-3">
               <select onChange={e => {
                   if(!e.target.value) return; 
                   const obs = observations.find(o => o.id === e.target.value); 
                   if(obs) updateConfig('observacoesAdicionais', (cfg.observacoesAdicionais ? cfg.observacoesAdicionais + '\n\n' : '') + (obs.desc_text || obs.desc)); 
                   e.target.value='';
               }} className="w-full bg-purple-50 border border-purple-100 text-purple-800 text-xs font-black uppercase tracking-widest rounded-xl px-4 py-3 outline-none cursor-pointer appearance-none shadow-sm touch-manipulation">
                  <option value="">+ Puxar texto padrão do sistema...</option>
                  {observations.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
               </select>
               <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-500 pointer-events-none" size={14}/>
            </div>
            <textarea rows="5" value={cfg.observacoesAdicionais || ''} onChange={e => updateConfig('observacoesAdicionais', e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded-xl p-4 text-xs font-mono outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all shadow-inner" placeholder="Inserir termos comerciais padrão Kalenborn..." />
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200 hidden lg:flex gap-4 shrink-0 z-50 w-[480px] xl:w-[550px]">
           <div className="w-24 text-center">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Desc %</label>
             <input type="number" step="0.1" max="3" min="0" value={cfg.desconto || 0} onChange={handleDescontoChange} className="w-full border-2 border-slate-200 h-12 rounded-xl text-sm font-black text-center outline-none focus:border-blue-500 bg-white shadow-sm" />
           </div>
           <button onClick={handleGeneratePDFAndUpload} disabled={isGeneratingPDF} className="flex-1 bg-[#0F172A] text-white font-black py-4 rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 mt-4 cursor-pointer touch-manipulation">
             {isGeneratingPDF ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />} <span>Baixar PDF Oficial</span>
           </button>
        </div>
      </div>

      <button onClick={() => setIsEditorVisible(!isEditorVisible)} className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-[60] bg-white border border-slate-200 shadow-2xl h-14 w-8 items-center justify-center rounded-r-2xl text-slate-400 hover:text-blue-600 transition-all duration-500 cursor-pointer" style={{ left: isEditorVisible ? (windowWidth >= 1280 ? '550px' : '480px') : '0px' }} title={isEditorVisible ? "Ocultar Painel" : "Mostrar Painel"}>
         {isEditorVisible ? <ChevronLeft size={20}/> : <ChevronRight size={20}/>}
      </button>

      {/* PAINEL DIREITO: PREVIEW DO PDF COM CONTAINER AJUSTADO */}
      <div id="print-scroll-container" className={`${mobileTab === 'editor' ? 'hidden' : 'flex'} lg:flex flex-1 h-full bg-slate-200 justify-center overflow-x-hidden overflow-y-auto pt-8 pb-32 lg:pb-8 custom-scrollbar relative z-10 w-full`}>
         <div className="pdf-preview-wrapper flex justify-center mx-auto shrink-0" style={{ width: '210mm', transform: `scale(${pdfScale})`, transformOrigin: 'top center', height: 'fit-content', transition: 'transform 0.3s ease' }}>
            <div className="bg-white shadow-2xl box-border" id="documento-pdf-real" style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }}>
               {renderPdfLayout()}
            </div>
         </div>
         {/* BOTÃO BAIXAR MOBILE (Aba Preview) */}
         <div className="lg:hidden fixed bottom-20 left-4 right-4 z-[70]">
           <button onClick={handleGeneratePDFAndUpload} disabled={isGeneratingPDF} className="w-full bg-[#0F172A] text-white font-black py-4 rounded-xl shadow-2xl flex justify-center items-center gap-2 uppercase tracking-widest cursor-pointer touch-manipulation active:scale-95 transition-transform">
             {isGeneratingPDF ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />} Gerar PDF Oficial
           </button>
         </div>
      </div>

      {/* OVERLAY DE LOADING */}
      {isGeneratingPDF && (
          <div className="fixed inset-0 z-[999999] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
              <RefreshCw className="animate-spin text-blue-500 mb-4" size={48} />
              <h2 className="text-2xl font-black uppercase tracking-widest">Processando PDF</h2>
              <p className="text-slate-300 mt-2 font-medium text-center px-4">Por favor aguarde, gerando arquivo com qualidade máxima...</p>
          </div>
      )}
    </div>
  );
}

// --- ABA 3: GESTÃO CRM ---
function ManagementView({ proposals, clients, updateStatus, loadProposalForEditing, deleteProposal }) {
  const [filter, setFilter] = useState('Todas');
  const [proposalToDelete, setProposalToDelete] = useState(null);
  
  const filtered = proposals.filter(p => filter === 'Todas' || p.status === filter);
  
  const dashboard = useMemo(() => {
     let totalL = 0; let totalA = 0; let qtdA = 0; let totalP = 0; let qtdP = 0;
     proposals.forEach(p => { 
       const val = parseFloat(p.total) || 0; totalL += val; 
       if(p.status === 'Aceita') { totalA += val; qtdA++; } 
       if(p.status === 'Pendente') { totalP += val; qtdP++; } 
     });
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
          <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto w-full sm:w-auto custom-scrollbar">
            {['Todas', 'Pendente', 'Aceita', 'Recusada'].map(s => <button key={s} onClick={()=>setFilter(s)} className={`cursor-pointer touch-manipulation px-4 sm:px-5 py-2 sm:py-2.5 text-[10px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${filter===s?'bg-slate-900 text-white shadow-xl':'text-slate-400 hover:bg-slate-50'}`}>{s}</button>)}
          </div>
       </header>
       
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-8 shrink-0">
          <Card label="Faturamento Total" val={dashboard.totalL} color="text-blue-600" icon={Globe} />
          <Card label="Aceitas (Fechado)" val={dashboard.totalA} qtd={dashboard.qtdA} color="text-emerald-600" icon={Handshake} />
          <Card label="Em Aberto" val={dashboard.totalP} qtd={dashboard.qtdP} color="text-amber-600" icon={Clock} />
       </div>
       
       <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col animate-in fade-in duration-500">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <tr><th className="p-4 sm:p-5">Nº Proposta</th><th className="p-4 sm:p-5">Vendedor</th><th className="p-4 sm:p-5">Cliente</th><th className="p-4 sm:p-5 text-center">Status</th><th className="p-4 sm:p-5 text-right">Valor Total</th><th className="p-4 sm:p-5 text-center">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 sm:p-5 font-black font-mono text-blue-700">{p.numeroUnico}</td>
                    <td className="p-4 sm:p-5 font-bold text-slate-800 text-xs capitalize">{p.config?.vendedor || '---'}</td>
                    <td className="p-4 sm:p-5 font-bold text-slate-600 text-xs uppercase min-w-[150px]">{clients.find(c=>c.id===p.clientId)?.company || 'Desconhecido'}</td>
                    <td className="p-4 sm:p-5 text-center"><select value={p.status} onChange={e=>updateStatus(p.id, e.target.value)} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl outline-none shadow-sm border cursor-pointer touch-manipulation appearance-none text-center ${p.status==='Aceita'?'bg-emerald-50 text-emerald-600 border-emerald-100':'bg-amber-50 text-amber-600 border-amber-100'}`}><option value="Pendente">Pendente</option><option value="Aceita">Aceita</option><option value="Recusada">Recusada</option></select></td>
                    <td className="p-4 sm:p-5 text-right font-black text-slate-700 font-mono">R$ {formatNum(p.total)}</td>
                    <td className="p-4 sm:p-5 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => loadProposalForEditing(p)} className="p-2 sm:h-10 sm:w-10 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all touch-manipulation shadow-sm flex items-center justify-center cursor-pointer" title="Editar"><Edit size={16}/></button>
                        {p.attachment_url && <a href={p.attachment_url} target="_blank" rel="noreferrer" className="p-2 sm:h-10 sm:w-10 text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center cursor-pointer touch-manipulation" title="Baixar PDF"><Download size={16}/></a>}
                        <button onClick={() => setProposalToDelete(p)} className="p-2 sm:h-10 sm:w-10 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-600 hover:text-white transition-all touch-manipulation shadow-sm flex items-center justify-center cursor-pointer" title="Excluir"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
       </div>

       {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
       {proposalToDelete && (
         <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
             <div className="p-6 text-center">
               <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Trash2 size={32} />
               </div>
               <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Proposta?</h3>
               <p className="text-sm text-slate-500 mb-6">Tem a certeza que deseja excluir a proposta <strong className="text-slate-800">{proposalToDelete.numeroUnico}</strong>? Esta ação não pode ser desfeita e irá apagá-la do banco de dados.</p>
               <div className="flex gap-3">
                 <button onClick={() => setProposalToDelete(null)} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">Cancelar</button>
                 <button onClick={() => { deleteProposal(proposalToDelete.id); setProposalToDelete(null); }} className="flex-1 py-3 text-white font-bold bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-lg shadow-rose-600/30 cursor-pointer">Sim, Excluir</button>
               </div>
             </div>
           </div>
         </div>
       )}
    </div>
  );
}

// --- ABA SIMULADOR 3D ---
function SimulatorView() {
    const [currentKey, setCurrentKey] = useState('WPHSKRX-774');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isInfoOpen, setInfoOpen] = useState(window.innerWidth >= 768);
    const [isWireframe, setWireframe] = useState(false);
    const [isAssembled, setAssembled] = useState(true);
    const [isAutoRotate, setAutoRotate] = useState(false);
    const [isPanMode, setPanMode] = useState(false);

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

    return (
        <div className="flex flex-col h-full bg-slate-100 relative overflow-hidden font-sans">
            <header className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4 shadow-sm z-30">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <h1 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><Box size={20} className="text-sky-600" /> Simulador 3D</h1>
                    <select value={currentKey} onChange={e => setCurrentKey(e.target.value)} className="flex-1 sm:w-[400px] lg:w-[500px] p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm font-bold shadow-inner outline-none focus:border-sky-500 cursor-pointer text-slate-700">
                        {Object.keys(simulatorDatabase).map(k => (
                            <option key={k} value={k}>{simulatorDatabase[k].dimsStr}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 w-full sm:w-auto justify-center">
                    <button onClick={() => setWireframe(!isWireframe)} className={`flex-1 sm:flex-none p-3 rounded-xl border transition-all shadow-md active:scale-95 touch-manipulation cursor-pointer ${isWireframe ? 'bg-sky-600 text-white' : 'bg-white text-slate-600'}`} title="Estrutura"><Grid size={18}/></button>
                    <button onClick={() => setAssembled(!isAssembled)} className={`flex-1 sm:flex-none p-3 rounded-xl border transition-all shadow-md active:scale-95 touch-manipulation cursor-pointer ${!isAssembled ? 'bg-orange-600 text-white' : 'bg-white text-slate-600'}`} title="Desmontar"><Wrench size={18}/></button>
                    <button onClick={() => setAutoRotate(!isAutoRotate)} className={`flex-1 sm:flex-none p-3 rounded-xl border transition-all shadow-md active:scale-95 touch-manipulation cursor-pointer ${isAutoRotate ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`} title="Girar"><RefreshCw size={18} className={isAutoRotate ? 'animate-spin' : ''}/></button>
                </div>
            </header>
            <div ref={canvasRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing z-10" />
            <div ref={labelsRef} className="absolute inset-0 pointer-events-none z-20" />
            <div className="absolute bottom-6 left-6 right-6 lg:left-auto lg:w-80 bg-white/95 backdrop-blur border border-slate-200 p-5 rounded-2xl shadow-2xl z-30 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-3 text-sky-600 font-black uppercase text-[10px] tracking-widest border-b pb-2">
                    <Info size={14}/> Ficha Técnica
                </div>
                <div className="space-y-3">
                    <div className="text-slate-800 font-bold text-sm tracking-tight">{activeProject.type}</div>
                    
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cód KBN</span>
                            <span className="font-bold text-slate-700">{activeProject.id}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                        <div className="space-y-1">
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dimensões</div>
                            <div className="text-slate-700 font-black text-xs">{activeProject.dimsStr}</div>
                        </div>
                        <div className="space-y-1 text-right">
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Parafuso</div>
                            <div className="text-orange-600 font-black text-xs">{activeProject.screwStr}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- ABA FICHA TÉCNICA (NOVA) ---
function TechnicalSheetView({ products, customLogo, showToast, initialSelectedId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(initialSelectedId || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListVisible, setIsListVisible] = useState(true);

  const eligibleProducts = useMemo(() => {
    return products.filter(p => {
      const txt = `${p.name} ${p.codKalenborn} ${p.descricao_original || ''} ${p.id}`.toLowerCase();
      return txt.includes('bandeja') || txt.includes('kalimpact') || txt.includes('wphskrx') || txt.includes('kbwpklt') || txt.includes('placa');
    });
  }, [products]);

  const filtered = useMemo(() => {
    if (!searchTerm) return eligibleProducts;
    const lower = searchTerm.toLowerCase();
    return eligibleProducts.filter(p => 
      (p.name && p.name.toLowerCase().includes(lower)) || 
      (p.codKalenborn && p.codKalenborn.toLowerCase().includes(lower)) ||
      (p.descricao_original && p.descricao_original.toLowerCase().includes(lower)) ||
      (p.codvale && String(p.codvale).toLowerCase().includes(lower)) ||
      (p.id && String(p.id).toLowerCase().includes(lower))
    );
  }, [searchTerm, eligibleProducts]);

  useEffect(() => {
    if (filtered.length > 0 && !selectedId) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      if (window.innerWidth < 1024) setIsListVisible(false);
    }
  }, [initialSelectedId]);

  const selectedProduct = eligibleProducts.find(p => p.id === selectedId) || eligibleProducts[0];

  const handleDownload = async () => {
    if (!window.html2pdf || !selectedProduct) return;
    setIsGenerating(true);
    
    setTimeout(async () => {
      const scrollContainer = document.getElementById('tech-sheet-scroll-container');
      if (scrollContainer) {
          scrollContainer.scrollLeft = 0;
          scrollContainer.scrollTop = 0;
      }

      const element = document.getElementById('ficha-tecnica-pdf-real');

      const opt = {
        margin: 0,
        filename: `Ficha_Tecnica_${selectedProduct.codvale || selectedProduct.id}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
          scale: 2, 
          dpi: 300,
          useCORS: true, 
          letterRendering: true, 
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
        await window.html2pdf().set(opt).from(element).save();
        showToast("Ficha Técnica baixada com sucesso!");
      } catch(e) {
        console.error(e);
        showToast("Erro ao gerar PDF.");
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const renderFicha = () => {
    if (!selectedProduct) return null;
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}>
        <header className="flex justify-between items-center mb-8 border-b-2 border-black pb-4">
          <img src={customLogo || defaultLogoBase64} alt="Kalenborn Logo" className="h-16 object-contain" />
          <div className="text-right">
            <h2 className="text-xl font-black text-[#14325a]">FICHA TÉCNICA</h2>
            <div className="text-sm font-bold text-gray-500">PRODUTOS KALENBORN</div>
          </div>
        </header>

        <div className="text-center font-black text-xl uppercase mb-8 p-4 bg-gray-100 border border-black rounded-sm">
          {selectedProduct.name || selectedProduct.id}
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-bold text-sm uppercase bg-black text-white px-3 py-1 inline-block mb-2">Descrição Longa</h3>
            <div className="p-4 border border-black min-h-[100px] text-sm leading-relaxed text-justify uppercase font-bold">
              {selectedProduct.descricao_original || selectedProduct.codKalenborn || 'Sem descrição detalhada'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-sm uppercase bg-black text-white px-3 py-1 inline-block mb-2">Part Number / Cód Vale</h3>
              <div className="p-4 border border-black text-lg font-black text-center">
                {selectedProduct.codvale || 'N/A'}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase bg-black text-white px-3 py-1 inline-block mb-2">Cód Kalenborn (KBN)</h3>
              <div className="p-4 border border-black text-lg font-black text-center text-gray-600">
                {selectedProduct.id}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-sm uppercase bg-black text-white px-3 py-1 inline-block mb-2">NCM</h3>
              <div className="p-3 border border-black text-center font-bold">
                {selectedProduct.ncm || 'Consultar'}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase bg-black text-white px-3 py-1 inline-block mb-2">Unidade de Medida</h3>
              <div className="p-3 border border-black text-center font-bold">
                {selectedProduct.um || 'UN'}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-20 pt-4 border-t-2 border-black text-[10px] text-center font-bold">
          <div>KALENBORN DO BRASIL LTDA | Estrada Antiga BH - Pedro Leopoldo, 1150 Galpão 03 - Vespasiano / MG</div>
          <div>Tel.: +55 31 3499-4000 | comercial@kalenborn.com.br | www.kalenborn.com.br</div>
        </footer>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-slate-100 overflow-hidden relative">
      <div className={`bg-white flex flex-col h-full shadow-2xl z-40 shrink-0 transition-all duration-500 ${isListVisible ? 'w-full lg:w-[350px] translate-x-0 border-r border-slate-200' : 'w-0 -translate-x-full border-none overflow-hidden'}`}>
        <div className="w-full lg:w-[350px] flex flex-col h-full">
          <div className="p-5 border-b bg-slate-50">
            <h2 className="font-black text-slate-800 text-lg uppercase flex items-center gap-2"><Layers size={20} className="text-blue-600" /> Fichas Técnicas</h2>
            <p className="text-xs text-slate-500 mt-1">Gere PDFs de bandejas e produtos.</p>
          </div>
          <div className="p-4 border-b bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Buscar peça..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-blue-500 outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filtered.map(p => (
              <button key={p.id} onClick={() => { setSelectedId(p.id); if(window.innerWidth < 1024) setIsListVisible(false); }} className={`w-full text-left p-3 rounded-lg mb-1 transition-colors touch-manipulation ${selectedId === p.id ? 'bg-blue-50 border-blue-200 border text-blue-800' : 'hover:bg-slate-50 border border-transparent text-slate-600'}`}>
                <div className="font-bold text-xs line-clamp-1">{p.name || p.codKalenborn}</div>
                <div className="text-[10px] text-slate-400 mt-1">Vale: {p.codvale || 'N/A'} | KBN: {p.id}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-center p-4 text-xs text-slate-400">Nenhuma peça encontrada.</div>}
          </div>
        </div>
      </div>
      
      <button onClick={() => setIsListVisible(!isListVisible)} className="hidden lg:flex absolute top-1/2 -translate-y-1/2 z-[60] bg-white border border-slate-200 shadow-2xl h-14 w-8 items-center justify-center rounded-r-2xl text-slate-400 hover:text-blue-600 transition-all duration-500 cursor-pointer" style={{ left: isListVisible ? '350px' : '0px' }} title={isListVisible ? "Ocultar Painel" : "Mostrar Painel"}>
         {isListVisible ? <ChevronLeft size={20}/> : <ChevronRight size={20}/>}
      </button>

      <div id="tech-sheet-scroll-container" className="flex-1 flex flex-col items-center overflow-auto p-8 custom-scrollbar bg-slate-200 relative z-10">
        {selectedProduct ? (
          <>
            <div className="w-full max-w-[210mm] flex justify-between mb-4">
              <button onClick={() => setIsListVisible(true)} className="lg:hidden bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold py-2.5 px-4 rounded-lg shadow-sm flex items-center gap-2 active:scale-95 cursor-pointer touch-manipulation">
                <ChevronLeft size={18} /> Voltar à Lista
              </button>
              <button onClick={handleDownload} disabled={isGenerating} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer touch-manipulation ml-auto">
                {isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />} Baixar PDF
              </button>
            </div>
            <div className="bg-white shadow-2xl mb-10 shrink-0 box-border" style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }} id="ficha-tecnica-pdf-real">
              {renderFicha()}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Layers size={48} className="mb-4 opacity-50" />
            <p>Selecione uma peça na lista para ver a ficha técnica.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- ABA 4: CONFIGURAÇÕES ---
function SettingsView({ showToast, setCustomLogo, currentLogo, refreshData, openAIApiKey, setOpenAIApiKey }) {
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showToast("Salvando Logo no Storage...");
    try { const publicUrl = await supabaseUpload('portal-files', 'branding/logo_main.png', file); setCustomLogo(publicUrl); localStorage.setItem('kalenborn_logo', publicUrl); await supabaseRequest('settings', 'POST', { id: 'logo', value: publicUrl }, true); showToast("✅ Logo Atualizada no Storage e no Banco!"); refreshData(); } catch (err) { showToast("Erro ao salvar logo."); }
  };
  const handleSaveApiKey = async () => {
    showToast("Salvando chave da OpenAI...");
    try { await supabaseRequest('settings', 'POST', { id: 'openai_key', value: openAIApiKey }, true); localStorage.setItem('kalenborn_openai_key', openAIApiKey); showToast("✅ Chave salva!"); refreshData(); } catch (err) { showToast("Erro."); }
  };
  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-10 h-full overflow-y-auto custom-scrollbar font-sans text-left">
       <h1 className="text-3xl font-black text-slate-800 uppercase tracking-widest border-b pb-4">Ajustes do Sistema</h1>
       <div className="bg-purple-50 p-6 sm:p-8 rounded-[2rem] border border-purple-200 shadow-sm mb-6"><h2 className="text-lg font-black mb-2 text-purple-900 flex items-center gap-2"><Bot size={24}/> Inteligência Artificial</h2><p className="text-sm text-purple-700 mb-6 font-medium">Configure a chave da API para ativar o cálculo fiscal inteligente.</p><div className="relative mb-4"><input type="password" value={openAIApiKey} onChange={(e) => setOpenAIApiKey(e.target.value)} placeholder="sk-proj-..." className="w-full pl-6 pr-10 py-4 rounded-xl border border-purple-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono shadow-inner bg-white shadow-purple-900/5" /><Key size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400" /></div><button onClick={handleSaveApiKey} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-purple-700 transition-all shadow-lg active:scale-95 cursor-pointer touch-manipulation">Salvar Chave API</button></div>
       <div className="bg-white p-6 sm:p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-12 justify-center"><div className="h-40 w-full md:w-80 border-2 border-slate-100 bg-slate-50/50 rounded-[2rem] flex items-center justify-center p-8 shadow-inner"><img src={currentLogo || defaultLogoBase64} alt="Logo" className="max-h-full max-w-full object-contain filter drop-shadow-md" /></div><label className="bg-[#0F172A] text-white px-10 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-blue-600 transition-all shadow-xl active:scale-95 flex items-center gap-2 touch-manipulation"><FileUp size={16}/> Alterar Logo no Banco<input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" /></label></div>
    </div>
  );
}
