// تنظیمات اولیه
const API_URL = "https://script.google.com/macros/s/AKfycbwqC12LXsRFoPOm6P19_QEuJc6bBPXNOCsyZjd4vi7eibfGKA-7-0wXSBfeFQe4NW-2/exec";
let order = [];
let fullMenu = {};
let dailyReports = {};

// نمایش نوتیفیکیشن
function showNotification(message, type = 'success') {
  const notif = document.getElementById('notification');
  notif.textContent = message;
  notif.className = `notification ${type}`;
  notif.style.display = 'block';
  
  setTimeout(() => {
    notif.style.display = 'none';
  }, 3000);
}

// بارگذاری منو - نسخه اصلاح شده
async function loadMenu() {
    try {
      showNotification('در حال بارگذاری منو...', 'warning');
      
      const response = await fetch(API_URL, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`خطای شبکه: ${response.status}`);
      }
      
      const responseData = await response.json();
      fullMenu = normalizeMenuData(responseData.menu);
      renderMenu();
      saveMenuToLocal();
      showNotification('منو با موفقیت بارگذاری شد');
      
    } catch (error) {
      console.error('خطا در بارگذاری منو:', error);
      showNotification('خطا در بارگذاری منو. استفاده از داده‌های محلی...', 'error');
      loadLocalMenu();
    }
  }
  
  // ثبت سفارش - نسخه اصلاح شده
  async function submitOrder() {
    if (order.length === 0) {
      showNotification('سفارشی برای ثبت وجود ندارد', 'error');
      return;
    }
  
    const orderData = {
      items: order,
      total: order.reduce((sum, item) => sum + (item.price * item.qty), 0),
      date: new Date().toLocaleString('fa-IR')
    };
  
    try {
      showNotification('در حال ثبت سفارش...', 'warning');
      
      const response = await fetch(API_URL, {
        method: 'POST',
        mode: "no-cors",
        body: JSON.stringify(orderData),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`خطای سرور: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        showNotification('سفارش با موفقیت ثبت شد');
        saveOrderToHistory();
        printInvoice();
        order = [];
        updateOrderTable();
      } else {
        throw new Error(result.error || 'خطا در ثبت سفارش');
      }
      
    } catch (error) {
      console.error('خطا در ثبت سفارش:', error);
      showNotification(error.message, 'error');
    }
  }



// نرمالایز کردن داده‌های منو - نسخه بهبود یافته
function normalizeMenuData(menuData) {
    const normalized = {};
    
    // بررسی وجود داده و نوع آن
    if (!menuData || typeof menuData !== 'object') {
      console.error('داده‌های منو نامعتبر هستند:', menuData);
      return normalized;
    }
  
    // بررسی اگر menuData خودش مستقیماً آرایه آیتم‌هاست
    if (Array.isArray(menuData)) {
      normalized['دسته‌بندی پیش‌فرض'] = menuData.map(item => ({
        'نام آیتم': String(item['نام آیتم'] || item['نام'] || item['item'] || 'آیتم بدون نام'),
        'قیمت': Math.abs(Number(item['قیمت']) || 0),
        'توضیحات': String(item['توضیحات'] || item['description'] || '')
      }));
      return normalized;
    }
  
    // پردازش ساختار معمولی (آبجکت با دسته‌بندی‌ها)
    for (const [category, items] of Object.entries(menuData)) {
      if (!category || !items) continue;
  
      // اگر آیتم‌ها آرایه هستند
      if (Array.isArray(items)) {
        normalized[category] = items
          .map(item => ({
            'نام آیتم': String(item['نام آیتم'] || item['نام'] || item['item'] || ''),
            'قیمت': Math.abs(Number(item['قیمت']) || 0),
            'توضیحات': String(item['توضیحات'] || item['description'] || '')
          }))
          .filter(item => item['نام آیتم'].trim() !== '');
      } 
      // اگر آیتم‌ها به صورت آبجکت هستند (فرمت قدیمی)
      else if (typeof items === 'object') {
        normalized[category] = Object.values(items)
          .map(item => ({
            'نام آیتم': String(item['نام آیتم'] || item['نام'] || item['item'] || ''),
            'قیمت': Math.abs(Number(item['قیمت']) || 0),
            'توضیحات': String(item['توضیحات'] || item['description'] || '')
          }))
          .filter(item => item['نام آیتم'].trim() !== '');
      }
  
      // حذف دسته‌بندی‌های خالی
      if (normalized[category] && normalized[category].length === 0) {
        delete normalized[category];
      }
    }
  
    return normalized;
  }
  
// تبدیل فرمت قدیمی منو به فرمت جدید
function convertLegacyMenu(legacyData) {
  const convertedMenu = {};
  for (const [category, items] of Object.entries(legacyData)) {
    if (Array.isArray(items)) {
      convertedMenu[category] = items.map(item => ({
        'نام آیتم': item['نام آیتم'] || item['نام'] || item['item'] || '',
        'قیمت': Number(item['قیمت']) || 0,
        'توضیحات': item['توضیحات'] || item['description'] || ''
      }));
    }
  }
  return convertedMenu;
}

// بارگذاری منو از حافظه محلی
function loadLocalMenu() {
  const savedMenu = localStorage.getItem('cafeMenu');
  if (savedMenu) {
    try {
      fullMenu = JSON.parse(savedMenu);
      
      // اعتبارسنجی ساختار داده
      if (typeof fullMenu !== 'object' || fullMenu === null) {
        throw new Error('فرمت داده‌های منو نامعتبر است');
      }
      
      renderMenu();
      renderAdminMenu();
      populateCategorySelectors();
      showNotification('منو از حافظه محلی بارگذاری شد', 'warning');
    } catch (error) {
      console.error('خطا در بارگذاری منوی محلی:', error);
      loadDefaultMenu();
    }
  } else {
    loadDefaultMenu();
  }
}

// بارگذاری منوی پیش‌فرض
function loadDefaultMenu() {
  fullMenu = {
    "نوشیدنی‌های گرم": [
      {"نام آیتم": "اسپرسو", "قیمت": 15000, "توضیحات": "قهوه خالص"},
      {"نام آیتم": "کاپوچینو", "قیمت": 20000, "توضیحات": "با شیر بخارزده"}
    ],
    "نوشیدنی‌های سرد": [
      {"نام آیتم": "آیس لته", "قیمت": 25000, "توضیحات": "با یخ و شیر"},
      {"نام آیتم": "موکا سرد", "قیمت": 28000, "توضیحات": "با شکلات و خامه"}
    ]
  };
  
  renderMenu();
  renderAdminMenu();
  populateCategorySelectors();
  showNotification('منوی پیش‌فرض بارگذاری شد', 'warning');
  saveMenuToLocal();
}

// پر کردن انتخابگرهای دسته‌بندی
function populateCategorySelectors() {
  const selectors = [
    document.getElementById('categorySelect'),
    document.getElementById('itemCategory'),
    document.getElementById('historyFilter')
  ];
  
  selectors.forEach(selector => {
    if (selector) {
      if (selector.id === 'categorySelect') {
        selector.innerHTML = '<option value="all">همه دسته‌بندی‌ها</option>';
      } else {
        selector.innerHTML = '';
      }
      
      Object.keys(fullMenu).forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        selector.appendChild(option);
      });
    }
  });
}

// رندر منوی اصلی - سازگار با ساختار جدید
function renderMenu() {
    const category = document.getElementById('categorySelect').value;
    const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
    const menuDiv = document.getElementById('menu');
    menuDiv.innerHTML = '';
    
    let categoriesToShow = category === 'all' ? Object.keys(fullMenu) : [category];
    let hasItems = false;
    
    categoriesToShow.forEach(cat => {
      if (!fullMenu[cat] || !Array.isArray(fullMenu[cat])) {
        console.warn(`دسته‌بندی ${cat} وجود ندارد یا معتبر نیست`);
        return;
      }
      
      const filteredItems = fullMenu[cat].filter(item => 
        item['نام آیتم'] && item['نام آیتم'].toLowerCase().includes(keyword)
      );
      
      if (filteredItems.length === 0) return;
      hasItems = true;
      
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'menu-category';
      categoryDiv.innerHTML = `<h3>${cat}</h3>`;
      
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'menu-items';
      
      filteredItems.forEach(item => {
        const itemName = item['نام آیتم'] || 'آیتم بدون نام';
        const itemPrice = item['قیمت'] || 0;
        const itemDesc = item['توضیحات'] || '';
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'menu-item';
        itemDiv.innerHTML = `
          <div class="item-info">
            <h4>${itemName}</h4>
            <p>${Number(itemPrice).toLocaleString('fa-IR')} تومان</p>
            ${itemDesc ? `<p class="item-desc">${itemDesc}</p>` : ''}
          </div>
          <div class="item-actions">
            <input type="number" min="1" value="1" id="qty-${itemName}" style="width: 60px;">
            <button onclick='addToOrder("${itemName}", ${itemPrice})'>+ افزودن</button>
          </div>
        `;
        itemsContainer.appendChild(itemDiv);
      });
      
      categoryDiv.appendChild(itemsContainer);
      menuDiv.appendChild(categoryDiv);
    });
    
    if (!hasItems) {
      menuDiv.innerHTML = '<p>آیتمی با این مشخصات یافت نشد</p>';
    }
  }



// رندر منوی مدیریت - نسخه نهایی اصلاح شده
function renderAdminMenu() {
    const adminMenuDiv = document.getElementById('adminMenuContent');
    if (!adminMenuDiv) return;
    
    adminMenuDiv.innerHTML = '';
    
    if (!fullMenu || typeof fullMenu !== 'object') {
      adminMenuDiv.innerHTML = '<p>داده‌های منو نامعتبر هستند</p>';
      return;
    }
    
    const categories = Object.keys(fullMenu);
    if (categories.length === 0) {
      adminMenuDiv.innerHTML = '<p>هیچ دسته‌بندی یافت نشد</p>';
      return;
    }
    
    categories.forEach(category => {
      const items = fullMenu[category];
      if (!Array.isArray(items)) {
        console.warn(`داده‌های دسته‌بندی ${category} معتبر نیستند`);
        return;
      }
      
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'menu-category';
      categoryDiv.innerHTML = `
        <h3 style="display: flex; justify-content: space-between; align-items: center;">
          ${category}
          <span>
            <button onclick="editCategory('${category.replace(/'/g, "\\'")}')" class="warning">ویرایش</button>
            <button onclick="deleteCategory('${category.replace(/'/g, "\\'")}')" class="danger">حذف</button>
          </span>
        </h3>
      `;
      
      const itemsTable = document.createElement('table');
      itemsTable.innerHTML = `
        <thead>
          <tr>
            <th>نام آیتم</th>
            <th>قیمت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody id="items-${category}"></tbody>
      `;
      
      items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          console.warn('آیتم نامعتبر:', item);
          return;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item['نام آیتم'] || 'آیتم بدون نام'}</td>
          <td>${(item['قیمت'] || 0).toLocaleString('fa-IR')}</td>
          <td>
            <button onclick="editItem('${category.replace(/'/g, "\\'")}', ${index})" class="warning">ویرایش</button>
            <button onclick="deleteItem('${category.replace(/'/g, "\\'")}', ${index})" class="danger">حذف</button>
          </td>
        `;
        itemsTable.querySelector('tbody').appendChild(row);
      });
      
      categoryDiv.appendChild(itemsTable);
      adminMenuDiv.appendChild(categoryDiv);
    });
  }

// بازنشانی فیلترها
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('categorySelect').value = 'all';
  renderMenu();
}

// افزودن آیتم به سفارش
function addToOrder(name, price) {
  const qtyInput = document.getElementById(`qty-${name}`);
  const qty = parseInt(qtyInput.value);
  
  if (isNaN(qty) || qty < 1) {
    showNotification('لطفاً تعداد معتبر وارد کنید', 'error');
    qtyInput.focus();
    return;
  }
  
  const existingItem = order.find(item => item.name === name);
  if (existingItem) {
    existingItem.qty += qty;
  } else {
    order.push({ name, price, qty });
  }
  
  updateOrderTable();
  showNotification(`"${name}" به سفارش اضافه شد`);
  qtyInput.value = 1;
}

// به‌روزرسانی جدول سفارشات
function updateOrderTable() {
  const tableBody = document.getElementById('orderTable');
  tableBody.innerHTML = '';
  
  let total = 0;
  
  order.forEach((item, index) => {
    const row = document.createElement('tr');
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    
    row.innerHTML = `
      <td>${item.name}</td>
      <td>
        <input type="number" min="1" value="${item.qty}" 
               onchange="updateOrderItemQty(${index}, this.value)" style="width: 60px;">
      </td>
      <td>${item.price.toLocaleString('fa-IR')}</td>
      <td>${itemTotal.toLocaleString('fa-IR')}</td>
      <td>
        <button onclick="removeOrderItem(${index})" class="danger">حذف</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  document.getElementById('total').innerHTML = `
    جمع کل: <strong>${total.toLocaleString('fa-IR')}</strong> تومان
  `;
  
  localStorage.setItem('currentOrder', JSON.stringify(order));
}

// به‌روزرسانی تعداد آیتم در سفارش
function updateOrderItemQty(index, newQty) {
  newQty = parseInt(newQty);
  if (isNaN(newQty) || newQty < 1) {
    showNotification('لطفاً تعداد معتبر وارد کنید', 'error');
    return;
  }
  
  order[index].qty = newQty;
  updateOrderTable();
}

// حذف آیتم از سفارش
function removeOrderItem(index) {
  const itemName = order[index].name;
  order.splice(index, 1);
  updateOrderTable();
  showNotification(`"${itemName}" از سفارش حذف شد`);
}

// پاک کردن کامل سفارش
function clearOrder() {
  if (order.length === 0) {
    showNotification('سفارشی برای پاک کردن وجود ندارد', 'warning');
    return;
  }
  
  if (confirm('آیا مطمئن هستید که می‌خواهید سفارش فعلی را پاک کنید؟')) {
    order = [];
    updateOrderTable();
    showNotification('سفارش فعلی پاک شد');
  }
}

// نمایش پیش‌نمایش فاکتور
function showOrderPreview() {
  if (order.length === 0) {
    showNotification('سفارشی برای نمایش وجود ندارد', 'warning');
    return;
  }
  
  const previewContent = document.getElementById('previewContent');
  previewContent.innerHTML = '';
  
  const invoiceDiv = document.createElement('div');
  invoiceDiv.className = 'print-content';
  invoiceDiv.style.padding = '20px';
  invoiceDiv.style.fontFamily = 'Tahoma';
  
  // هدر فاکتور
  const header = document.createElement('div');
  header.style.textAlign = 'center';
  header.style.marginBottom = '20px';
  header.innerHTML = `
    <h2 style="color: var(--primary);">کافی‌شاپ دلپذیر</h2>
    <p>تلفن: ۰۲۱-۱۲۳۴۵۶۷۸</p>
    <p>تاریخ: ${new Date().toLocaleString('fa-IR')}</p>
    <hr style="margin: 15px 0; border-color: #eee;">
  `;
  invoiceDiv.appendChild(header);
  
  // جدول آیتم‌ها
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginBottom = '20px';
  
  let tableHTML = `
    <thead>
      <tr style="background: var(--primary); color: white;">
        <th style="padding: 10px; text-align: right;">نام آیتم</th>
        <th style="padding: 10px; width: 80px;">تعداد</th>
        <th style="padding: 10px; width: 100px;">قیمت واحد</th>
        <th style="padding: 10px; width: 120px;">جمع</th>
      </tr>
    </thead>
    <tbody>
  `;
  
  let total = 0;
  order.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    
    tableHTML += `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eee; text-align: right;">${item.name}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left;">${item.price.toLocaleString('fa-IR')}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #eee; text-align: left;">${itemTotal.toLocaleString('fa-IR')}</td>
      </tr>
    `;
  });
  
  tableHTML += `
      <tr style="font-weight: bold;">
        <td colspan="3" style="padding: 10px; text-align: right;">جمع کل:</td>
        <td style="padding: 10px; text-align: left;">${total.toLocaleString('fa-IR')} تومان</td>
      </tr>
    </tbody>
  `;
  
  table.innerHTML = tableHTML;
  invoiceDiv.appendChild(table);
  
  // فوتر فاکتور
  const footer = document.createElement('div');
  footer.style.textAlign = 'center';
  footer.style.marginTop = '30px';
  footer.style.fontSize = '12px';
  footer.style.color = '#666';
  footer.innerHTML = `
    <hr style="margin: 15px 0; border-color: #eee;">
    <p>با تشکر از خرید شما</p>
    <p>آدرس: تهران، خیابان نمونه، پلاک ۱۲۳</p>
  `;
  invoiceDiv.appendChild(footer);
  
  previewContent.appendChild(invoiceDiv);
  openModal('previewModal');
}

// چاپ فاکتور
function printInvoice() {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html dir="rtl">
    <head>
      <title>فاکتور کافی‌شاپ</title>
      <style>
        body { font-family: Tahoma; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
        th { background: #4a6fa5; color: white; }
        .header { text-align: center; margin-bottom: 20px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      ${document.getElementById('previewContent').innerHTML}
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() {
            window.close();
          }, 1000);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ثبت سفارش
async function submitOrder() {
    if (order.length === 0) {
      showNotification('سفارشی برای ثبت وجود ندارد', 'error');
      return;
    }
  
    
    // تبدیل آیتم‌ها به رشته قابل خواندن
    
    // ذخیره جزئیات کامل به صورت JSON برای استفاده احتمالی
    
  
    try {
      showNotification('در حال ثبت سفارش...', 'warning');
      
      // ارسال به گوگل شییت
      
      // ذخیره در تاریخچه محلی
      saveOrderToHistory();
      
      showNotification('سفارش با موفقیت ثبت شد');
      closeModal('previewModal');
      
      setTimeout(printInvoice, 500);
      order = [];
      updateOrderTable();
      
    } catch (error) {
      console.error('خطا در ثبت سفارش:', error);
      showNotification('خطا در ارسال به سرور، اما فاکتور چاپ خواهد شد', 'error');
      printInvoice();
    }
  }

// ذخیره سفارش در تاریخچه
function saveOrderToHistory() {
  const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  const orderWithDetails = {
    id: Date.now(),
    date: new Date().toLocaleString('fa-IR'),
    items: [...order],
    total: order.reduce((sum, item) => sum + (item.price * item.qty), 0)
  };
  
  history.unshift(orderWithDetails);
  localStorage.setItem('orderHistory', JSON.stringify(history));
}

// نمایش تاریخچه سفارشات
function showOrderHistory() {
  const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  const historyContent = document.getElementById('historyContent');
  historyContent.innerHTML = '';
  
  if (history.length === 0) {
    historyContent.innerHTML = '<p>تاریخچه سفارشات خالی است</p>';
  } else {
    history.forEach(order => {
      const orderDiv = document.createElement('div');
      orderDiv.style.marginBottom = '20px';
      orderDiv.style.padding = '15px';
      orderDiv.style.backgroundColor = '#f9f9f9';
      orderDiv.style.borderRadius = '5px';
      
      let itemsHTML = '<table style="width: 100%; margin: 10px 0;">';
      itemsHTML += `
        <tr>
          <th>آیتم</th>
          <th>تعداد</th>
          <th>قیمت</th>
          <th>جمع</th>
        </tr>
      `;
      
      order.items.forEach(item => {
        itemsHTML += `
          <tr>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>${item.price.toLocaleString('fa-IR')}</td>
            <td>${(item.price * item.qty).toLocaleString('fa-IR')}</td>
          </tr>
        `;
      });
      
      itemsHTML += `
        <tr style="font-weight: bold;">
          <td colspan="3">جمع کل:</td>
          <td>${order.total.toLocaleString('fa-IR')} تومان</td>
        </tr>
      </table>
      `;
      
      orderDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <h3>سفارش #${order.id.toString().slice(-4)} - ${order.date}</h3>
          <button onclick="reorderFromHistory(${order.id})" class="secondary">سفارش مجدد</button>
        </div>
        ${itemsHTML}
      `;
      
      historyContent.appendChild(orderDiv);
    });
  }
  
  openModal('historyModal');
}

// فیلتر تاریخچه سفارشات
function filterHistory() {
  const searchTerm = document.getElementById('historySearch').value.toLowerCase();
  const filterType = document.getElementById('historyFilter').value;
  const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  
  let filtered = [...history];
  
  // اعمال فیلتر زمانی
  const now = new Date();
  if (filterType === 'today') {
    filtered = filtered.filter(order => {
      const orderDate = new Date(order.id);
      return orderDate.toDateString() === now.toDateString();
    });
  } else if (filterType === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    filtered = filtered.filter(order => {
      const orderDate = new Date(order.id);
      return orderDate >= startOfWeek;
    });
  } else if (filterType === 'month') {
    filtered = filtered.filter(order => {
      const orderDate = new Date(order.id);
      return orderDate.getMonth() === now.getMonth() && 
             orderDate.getFullYear() === now.getFullYear();
    });
  }
  
  // اعمال جستجو
  if (searchTerm) {
    filtered = filtered.filter(order => 
      order.items.some(item => 
        item.name.toLowerCase().includes(searchTerm)
      ) || 
      order.date.includes(searchTerm) ||
      order.id.toString().includes(searchTerm)
    );
  }
  
  // نمایش نتایج فیلتر شده
  const historyContent = document.getElementById('historyContent');
  historyContent.innerHTML = '';
  
  if (filtered.length === 0) {
    historyContent.innerHTML = '<p>هیچ سفارشی با این فیلترها یافت نشد</p>';
  } else {
    filtered.forEach(order => {
      const orderDiv = document.createElement('div');
      orderDiv.style.marginBottom = '20px';
      orderDiv.style.padding = '15px';
      orderDiv.style.backgroundColor = '#f9f9f9';
      orderDiv.style.borderRadius = '5px';
      
      let itemsHTML = '<table style="width: 100%; margin: 10px 0;">';
      itemsHTML += `
        <tr>
          <th>آیتم</th>
          <th>تعداد</th>
          <th>قیمت</th>
          <th>جمع</th>
        </tr>
      `;
      
      order.items.forEach(item => {
        itemsHTML += `
          <tr>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>${item.price.toLocaleString('fa-IR')}</td>
            <td>${(item.price * item.qty).toLocaleString('fa-IR')}</td>
          </tr>
        `;
      });
      
      itemsHTML += `
        <tr style="font-weight: bold;">
          <td colspan="3">جمع کل:</td>
          <td>${order.total.toLocaleString('fa-IR')} تومان</td>
        </tr>
      </table>
      `;
      
      orderDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <h3>سفارش #${order.id.toString().slice(-4)} - ${order.date}</h3>
          <button onclick="reorderFromHistory(${order.id})" class="secondary">سفارش مجدد</button>
        </div>
        ${itemsHTML}
      `;
      
      historyContent.appendChild(orderDiv);
    });
  }
}

// سفارش مجدد از تاریخچه
function reorderFromHistory(orderId) {
  const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  const oldOrder = history.find(order => order.id === orderId);
  
  if (!oldOrder) {
    showNotification('سفارش مورد نظر یافت نشد', 'error');
    return;
  }
  
  if (confirm(`آیا می‌خواهید سفارش #${orderId.toString().slice(-4)} را مجدداً ثبت کنید؟`)) {
    order = [...oldOrder.items];
    updateOrderTable();
    closeModal('historyModal');
    showNotification('سفارش به لیست فعلی اضافه شد');
  }
}

// خروجی اکسل از تاریخچه
function exportToExcel() {
  const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  
  if (history.length === 0) {
    showNotification('تاریخچه سفارشات خالی است', 'warning');
    return;
  }
  
  let csv = 'ID,تاریخ,آیتم,تعداد,قیمت,جمع\n';
  
  history.forEach(order => {
    order.items.forEach(item => {
      csv += `"${order.id}","${order.date}","${item.name}","${item.qty}","${item.price}","${item.qty * item.price}"\n`;
    });
    csv += `"${order.id}","${order.date}","","","جمع کل:","${order.total}"\n\n`;
  });
  
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `تاریخچه_سفارشات_کافی‌شاپ_${new Date().toLocaleDateString('fa-IR')}.csv`;
  link.click();
  
  showNotification('خروجی اکسل با موفقیت دانلود شد');
}

// نمایش پنل مدیریت
function showAdminPanel() {
  renderAdminMenu();
  openModal('adminModal');
}

// اضافه کردن دسته‌بندی جدید
function showAddCategoryModal() {
  document.getElementById('newCategoryName').value = '';
  openModal('addCategoryModal');
}

function addNewCategory() {
  const categoryName = document.getElementById('newCategoryName').value.trim();
  
  if (!categoryName) {
    showNotification('لطفاً نام دسته‌بندی را وارد کنید', 'error');
    return;
  }
  
  if (fullMenu[categoryName]) {
    showNotification('این دسته‌بندی قبلاً اضافه شده است', 'error');
    return;
  }
  
  fullMenu[categoryName] = [];
  renderMenu();
  renderAdminMenu();
  populateCategorySelectors();
  saveMenuToLocal();
  closeModal('addCategoryModal');
  showNotification(`دسته‌بندی "${categoryName}" با موفقیت اضافه شد`);
}

// ویرایش دسته‌بندی
function editCategory(oldName) {
  const newName = prompt('نام جدید دسته‌بندی:', oldName);
  
  if (!newName || newName === oldName) return;
  
  if (fullMenu[newName]) {
    showNotification('این نام قبلاً استفاده شده است', 'error');
    return;
  }
  
  fullMenu[newName] = [...fullMenu[oldName]];
  delete fullMenu[oldName];
  renderMenu();
  renderAdminMenu();
  populateCategorySelectors();
  saveMenuToLocal();
  showNotification(`دسته‌بندی "${oldName}" به "${newName}" تغییر یافت`);
}

// حذف دسته‌بندی
function deleteCategory(name) {
  if (!confirm(`آیا مطمئن هستید می‌خواهید دسته‌بندی "${name}" را حذف کنید؟ تمام آیتم‌های آن نیز حذف خواهند شد.`)) {
    return;
  }
  
  delete fullMenu[name];
  renderMenu();
  renderAdminMenu();
  populateCategorySelectors();
  saveMenuToLocal();
  showNotification(`دسته‌بندی "${name}" حذف شد`, 'warning');
}

// اضافه کردن آیتم جدید
function showAddItemModal() {
  populateCategorySelectors();
  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
  openModal('addItemModal');
}

function addNewItem() {
  const category = document.getElementById('itemCategory').value;
  const name = document.getElementById('itemName').value.trim();
  const price = parseInt(document.getElementById('itemPrice').value);
  
  if (!name) {
    showNotification('لطفاً نام آیتم را وارد کنید', 'error');
    return;
  }
  
  if (isNaN(price) || price <= 0) {
    showNotification('لطفاً قیمت معتبر وارد کنید', 'error');
    return;
  }
  
  // بررسی تکراری نبودن نام آیتم در این دسته‌بندی
  if (fullMenu[category].some(item => item['نام آیتم'] === name)) {
    showNotification('این آیتم قبلاً در این دسته‌بندی اضافه شده است', 'error');
    return;
  }
  
  fullMenu[category].push({
    'نام آیتم': name,
    'قیمت': price
  });
  
  renderMenu();
  renderAdminMenu();
  saveMenuToLocal();
  closeModal('addItemModal');
  showNotification(`آیتم "${name}" به دسته‌بندی "${category}" اضافه شد`);
}

// ویرایش آیتم
function editItem(category, index) {
  const item = fullMenu[category][index];
  const newName = prompt('نام جدید آیتم:', item['نام آیتم']);
  
  if (!newName || newName === item['نام آیتم']) return;
  
  const newPrice = prompt('قیمت جدید:', item['قیمت']);
  if (!newPrice || isNaN(newPrice)) return;
  
  fullMenu[category][index] = {
    'نام آیتم': newName,
    'قیمت': parseInt(newPrice)
  };
  
  renderMenu();
  renderAdminMenu();
  saveMenuToLocal();
  showNotification('آیتم با موفقیت ویرایش شد');
}

// حذف آیتم
function deleteItem(category, index) {
  const itemName = fullMenu[category][index]['نام آیتم'];
  
  if (!confirm(`آیا مطمئن هستید می‌خواهید آیتم "${itemName}" را حذف کنید؟`)) {
    return;
  }
  
  fullMenu[category].splice(index, 1);
  renderMenu();
  renderAdminMenu();
  saveMenuToLocal();
  showNotification(`آیتم "${itemName}" حذف شد`, 'warning');
}

// ذخیره منو در حافظه محلی
function saveMenuToLocal() {
  localStorage.setItem('cafeMenu', JSON.stringify(fullMenu));
}

// تهیه پشتیبان
function backupData() {
  const data = {
    menu: fullMenu,
    history: JSON.parse(localStorage.getItem('orderHistory') || '[]'),
    currentOrder: JSON.parse(localStorage.getItem('currentOrder') || '[]'),
    timestamp: new Date().toLocaleString('fa-IR')
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `پشتیبان_کافی‌شاپ_${new Date().toLocaleDateString('fa-IR')}.json`;
  link.click();
  
  showNotification('پشتیبان با موفقیت تهیه شد');
}

// بازیابی پشتیبان
function restoreData(input) {
  const file = input.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      if (!data.menu || !Array.isArray(data.history)) {
        throw new Error('فرمت فایل پشتیبان نامعتبر است');
      }
      
      if (confirm('آیا مطمئن هستید می‌خواهید داده‌ها را بازیابی کنید؟ تمام داده‌های فعلی جایگزین خواهند شد.')) {
        fullMenu = data.menu;
        localStorage.setItem('orderHistory', JSON.stringify(data.history));
        localStorage.setItem('currentOrder', JSON.stringify(data.currentOrder || []));
        
        renderMenu();
        renderAdminMenu();
        populateCategorySelectors();
        order = JSON.parse(localStorage.getItem('currentOrder') || '[]');
        updateOrderTable();
        
        showNotification('داده‌ها با موفقیت بازیابی شدند');
      }
    } catch (error) {
      console.error('خطا در بازیابی پشتیبان:', error);
      showNotification('خطا در بازیابی پشتیبان. فایل معتبر نیست.', 'error');
    }
  };
  reader.readAsText(file);
  input.value = ''; // Reset input
}

// مدیریت تب‌ها
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.tabs .tab[onclick="switchTab('${tabId}')"]`).classList.add('active');
}

function switchAdminTab(tabId) {
  document.querySelectorAll('#adminModal .tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('#adminModal .tabs .tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`#adminModal .tabs .tab[onclick="switchAdminTab('${tabId}')"]`).classList.add('active');
}

// مدیریت مدال‌ها
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// تابع تبدیل تاریخ به شمسی
function toPersianDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    const options = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      calendar: 'persian',
      numberingSystem: 'arab'
    };
    
    return date.toLocaleDateString('fa-IR', options);
  }
  
  // بارگذاری اولیه صفحه
  document.addEventListener('DOMContentLoaded', function() {
    loadMenu();
    console.log("ساختار نهایی fullMenu:", JSON.stringify(fullMenu, null, 2));
console.log("تعداد دسته‌بندی‌ها:", Object.keys(fullMenu).length);
    // بارگذاری سفارش جاری از حافظه محلی
    const savedOrder = localStorage.getItem('currentOrder');
    if (savedOrder) {
      try {
        order = JSON.parse(savedOrder);
        updateOrderTable();
      } catch (error) {
        console.error('خطا در بارگذاری سفارش محلی:', error);
        order = [];
      }
    }
    
    // رویدادهای کلی برای بستن مدال‌ها با کلیک خارج از محتوا
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  });