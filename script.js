const dataStatus = document.getElementById('dataStatus');
const categorySelect = document.getElementById('categorySelect');
const sourceSelect = document.getElementById('sourceSelect');
const searchInput = document.getElementById('searchInput');
const resetFilters = document.getElementById('resetFilters');
const results = document.getElementById('results');
const resultCount = document.getElementById('resultCount');
const cardTemplate = document.getElementById('cardTemplate');

const DATA_SOURCES = [
  {
    id: 'momoshop',
    label: 'momo購物網',
    listFile: 'data/momoshop-2025-12-23.csv',
    detailFile: 'data/momoshop-detail-2025-12-23.csv',
  },
  {
    id: 'shopee',
    label: 'Shopee',
    listFile: 'data/shopee-2025-12-23.csv',
  },
];

const STATE = {
  items: [],
  filtered: [],
  categories: new Set(),
  sources: new Set(),
};

const fetchText = async (fileName) => {
  const response = await fetch(encodeURI(fileName));
  if (!response.ok) {
    throw new Error(`無法載入 ${fileName}`);
  }
  return response.text();
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const rowsToObjects = (rows) => {
  if (!rows.length) return [];
  const header = rows[0].map((cell) => cell.replace(/^\ufeff/, '').trim());
  return rows.slice(1).map((row) => {
    const obj = {};
    header.forEach((key, index) => {
      obj[key] = row[index] ?? '';
    });
    return obj;
  });
};

const getFirstValue = (obj, keys) => {
  for (const key of keys) {
    if (obj[key]) return obj[key];
  }
  return '';
};

const deriveCategory = (item) => {
  if (item.url) {
    try {
      const url = new URL(item.url);
      const kw = url.searchParams.get('kw');
      if (kw) return decodeURIComponent(kw);
      const catid = url.searchParams.get('catid');
      if (catid) return `類別 ${catid}`;
    } catch (error) {
      // ignore URL parsing errors
    }
  }
  if (item.title.includes('手錶')) return '手錶';
  if (item.title.includes('投影')) return '投影機';
  if (item.title.includes('耳機')) return '耳機';
  return '其他';
};

const summarizeSpec = (spec) => {
  if (!spec) return '未提供詳細規格';
  return spec.replace(/\s+/g, ' ').trim();
};

const buildCard = (item) => {
  const clone = cardTemplate.content.cloneNode(true);
  const imageContainer = clone.querySelector('.card-image');
  const tags = clone.querySelector('.card-tags');
  const title = clone.querySelector('.card-title');
  const price = clone.querySelector('.card-price');
  const spec = clone.querySelector('.card-spec');
  const link = clone.querySelector('.card-link');

  if (item.image) {
    const img = document.createElement('img');
    img.alt = item.title;
    img.loading = 'lazy';
    img.src = item.image;
    imageContainer.appendChild(img);
  } else {
    imageContainer.textContent = '無圖片';
  }

  const tagCategory = document.createElement('span');
  tagCategory.className = 'tag';
  tagCategory.textContent = item.category;
  tags.appendChild(tagCategory);

  const tagSource = document.createElement('span');
  tagSource.className = 'tag';
  tagSource.textContent = item.sourceLabel;
  tags.appendChild(tagSource);

  title.textContent = item.title || '未命名商品';
  price.textContent = item.price ? `NT$ ${item.price}` : '價格未提供';
  spec.textContent = item.spec ? summarizeSpec(item.spec) : '未提供詳細規格';
  link.href = item.url || '#';

  return clone;
};

const render = () => {
  results.innerHTML = '';
  STATE.filtered.forEach((item) => {
    results.appendChild(buildCard(item));
  });
  resultCount.textContent = STATE.filtered.length.toString();
};

const applyFilters = () => {
  const category = categorySelect.value;
  const source = sourceSelect.value;
  const keyword = searchInput.value.trim().toLowerCase();

  STATE.filtered = STATE.items.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSource = source === 'all' || item.source === source;
    const haystack = `${item.title} ${item.spec} ${item.price}`.toLowerCase();
    const matchesKeyword = !keyword || haystack.includes(keyword);
    return matchesCategory && matchesSource && matchesKeyword;
  });

  render();
};

const populateFilters = () => {
  STATE.categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });

  STATE.sources.forEach((source) => {
    const option = document.createElement('option');
    option.value = source.id;
    option.textContent = source.label;
    sourceSelect.appendChild(option);
  });
};

const loadMomoshopDetails = async (fileName) => {
  const text = await fetchText(fileName);
  const rows = parseCsv(text);
  const objects = rowsToObjects(rows);
  const map = new Map();
  objects.forEach((row) => {
    const url = row['goods-img-url href (6)'] || row['goods-img-url href'] || '';
    const spec = row.prdnoteArea || '';
    if (url && spec) {
      map.set(url, spec);
    }
  });
  return map;
};

const loadMomoshopItems = async (source, detailMap) => {
  const text = await fetchText(source.listFile);
  const rows = parseCsv(text);
  const objects = rowsToObjects(rows);
  return objects.map((row) => {
    const url = getFirstValue(row, [
      'goods-img-url href',
      'goods-img-url href (3)',
      'goods-img-url href (4)',
      'goods-img-url href (5)',
      'goods-img-url href (6)',
    ]);
    const title = row.prdName || row.sloganTitle || '';
    const image = getFirstValue(row, ['goods-img src', 'goods-img src (2)', 'goods-img src (3)']);
    const price = row.price || row['price (2)'] || '';
    const spec = detailMap.get(url) || '';

    return {
      source: source.id,
      sourceLabel: source.label,
      title: title.trim(),
      price: price.replace(/[()]/g, ''),
      url,
      image,
      spec,
    };
  });
};

const loadShopeeItems = async (source) => {
  const text = await fetchText(source.listFile);
  const rows = parseCsv(text);
  const objects = rowsToObjects(rows);
  return objects.map((row) => {
    const url = row['contents href'] || '';
    const title = row['line-clamp-2'] || '';
    const price = row.truncate || '';
    const image = row['w-full src'] || row['inset-y-0 src'] || '';
    const spec = '';

    return {
      source: source.id,
      sourceLabel: source.label,
      title: title.trim(),
      price,
      url,
      image,
      spec,
    };
  });
};

const loadData = async () => {
  try {
    const momoshopSource = DATA_SOURCES[0];
    const shopeeSource = DATA_SOURCES[1];
    const detailMap = await loadMomoshopDetails(momoshopSource.detailFile);

    const [momoshopItems, shopeeItems] = await Promise.all([
      loadMomoshopItems(momoshopSource, detailMap),
      loadShopeeItems(shopeeSource),
    ]);

    STATE.items = [...momoshopItems, ...shopeeItems]
      .filter((item) => item.title || item.url)
      .map((item) => {
        const category = deriveCategory(item);
        return { ...item, category };
      });

    STATE.items.forEach((item) => {
      STATE.categories.add(item.category);
    });

    DATA_SOURCES.forEach((source) => STATE.sources.add(source));

    populateFilters();
    STATE.filtered = STATE.items;
    render();

    dataStatus.textContent = `已載入 ${STATE.items.length} 筆商品資料`;
  } catch (error) {
    dataStatus.textContent = `資料載入失敗：${error.message}`;
  }
};

categorySelect.addEventListener('change', applyFilters);
sourceSelect.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);
resetFilters.addEventListener('click', () => {
  categorySelect.value = 'all';
  sourceSelect.value = 'all';
  searchInput.value = '';
  applyFilters();
});

loadData();
