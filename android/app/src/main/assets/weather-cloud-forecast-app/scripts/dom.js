const elementMap = {
  address: 'address',
  searchButton: 'search-btn',
  locateButton: 'locate-btn',
  daySelector: 'daySelector',
  statusBanner: 'status-banner',
  weatherDashboard: 'weather-dashboard',
  hourlyForecastList: 'hourly-forecast-list',
  sosButton: 'sos-button',
  sosModal: 'sos-modal',
  sosInstruction: 'sos-instruction',
  sosInfoContainer: 'sos-info-container',
  sosInfo: 'sos-info',
  sosActions: 'sos-actions',
  prepareSosButton: 'prepare-sos-btn',
  closeSosButton: 'close-sos-btn',
};

const cachedElements = {};

export function getElements() {
  Object.entries(elementMap).forEach(([key, id]) => {
    cachedElements[key] = document.getElementById(id);
  });
  return cachedElements;
}

export function getEl(key) {
  if (!cachedElements[key]) {
    getElements();
  }
  return cachedElements[key] || null;
}

export function clearElement(element) {
  if (!element) {
    return null;
  }
  element.replaceChildren();
  return element;
}

export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  const {
    className,
    text,
    attrs,
    dataset,
    children,
  } = options;

  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  if (attrs) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, value);
      }
    });
  }
  if (dataset) {
    Object.entries(dataset).forEach(([name, value]) => {
      element.dataset[name] = value;
    });
  }
  if (children?.length) {
    element.append(...children.filter(Boolean));
  }

  return element;
}

export function setStatus(message, type = 'info') {
  const banner = getEl('statusBanner');
  if (!banner) {
    return;
  }

  if (!message) {
    banner.textContent = '';
    banner.classList.add('is-hidden');
    banner.removeAttribute('data-type');
    return;
  }

  banner.textContent = message;
  banner.dataset.type = type;
  banner.classList.remove('is-hidden');
}
