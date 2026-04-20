import { clearElement, createElement, getEl, setStatus } from './dom.js';
import { getDeviceLocation } from './location.js';
import { fetchElevation, reverseGeocode } from './services.js';

function resetSosModal() {
  const instruction = getEl('sosInstruction');
  const infoContainer = getEl('sosInfoContainer');
  const info = getEl('sosInfo');
  const actions = clearElement(getEl('sosActions'));
  const prepareButton = getEl('prepareSosButton');

  instruction.textContent = '点击下方按钮，准备生成包含您当前位置的求救信息。';
  instruction.style.display = 'block';
  infoContainer.classList.add('is-hidden');
  info.textContent = '';
  actions?.replaceChildren();
  prepareButton.disabled = false;
  prepareButton.textContent = '准备求救信号';
  prepareButton.style.display = 'inline-flex';
}

function setModalOpen(isOpen) {
  const modal = getEl('sosModal');
  modal.classList.toggle('is-open', isOpen);
  modal.setAttribute('aria-hidden', String(!isOpen));
}

function buildSosText({ locationName, latitude, longitude, elevationText, timestamp }) {
  return [
    '紧急求救 (SOS)',
    '--------------------',
    '📍 位置描述:',
    locationName,
    '--------------------',
    '🛰️ 精确坐标:',
    `纬度: ${latitude.toFixed(6)}`,
    `经度: ${longitude.toFixed(6)}`,
    '--------------------',
    `⛰️ 海拔高度: ${elevationText}`,
    '--------------------',
    `🕒 时间: ${timestamp}`,
  ].join('\n').trim();
}

function createActionLink({ href, text, backgroundColor }) {
  return createElement('a', {
    className: 'modal-button',
    text,
    attrs: {
      href,
      style: `background-color: ${backgroundColor}; color: white;`,
    },
  });
}

async function prepareSosMessage() {
  const instruction = getEl('sosInstruction');
  const infoContainer = getEl('sosInfoContainer');
  const info = getEl('sosInfo');
  const actions = clearElement(getEl('sosActions'));
  const prepareButton = getEl('prepareSosButton');

  prepareButton.disabled = true;
  prepareButton.textContent = '正在生成...';
  instruction.textContent = '正在获取您的 GPS 位置，请稍候...';
  setStatus('正在生成 SOS 求救信息...', 'info');

  try {
    const position = await getDeviceLocation();
    const latitude = Number(position.coords?.latitude ?? position.latitude);
    const longitude = Number(position.coords?.longitude ?? position.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('定位结果无效');
    }

    const timestamp = new Date().toLocaleString('zh-CN');
    const [elevationResult, reverseResult] = await Promise.allSettled([
      fetchElevation(latitude, longitude),
      reverseGeocode(latitude, longitude),
    ]);

    const elevationText = elevationResult.status === 'fulfilled'
      ? `${Math.round(elevationResult.value)} 米`
      : 'N/A (离线)';
    const locationName = reverseResult.status === 'fulfilled'
      ? reverseResult.value
      : 'N/A (离线)';
    const sosText = buildSosText({
      locationName,
      latitude,
      longitude,
      elevationText,
      timestamp,
    });
    const encodedText = encodeURIComponent(sosText);

    instruction.style.display = 'none';
    info.textContent = sosText;
    infoContainer.classList.remove('is-hidden');
    prepareButton.style.display = 'none';

    actions.append(
      createActionLink({
        href: `sms:?body=${encodedText}`,
        text: '通过短信发送',
        backgroundColor: 'var(--success-color)',
      }),
      createActionLink({
        href: `mailto:?subject=${encodeURIComponent('紧急求救 (SOS)')}&body=${encodedText}`,
        text: '通过邮件发送',
        backgroundColor: 'var(--accent-color)',
      }),
      createElement('button', {
        className: 'modal-button',
        text: '复制文本',
        attrs: {
          type: 'button',
          style: 'background-color: #6c757d; color: white;',
        },
      }),
    );

    const copyButton = actions.querySelector('button');
    copyButton?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(sosText);
        setStatus('求救信息已复制，可立即发送。', 'success');
      } catch (_error) {
        setStatus('复制失败，请手动长按复制文本。', 'warning');
      }
    });

    setStatus('求救信息已生成，可复制或发送。', 'success');
  } catch (error) {
    instruction.textContent = `GPS 定位失败！\n错误：${error.message}\n请移到开阔地带，或检查手机定位权限。`;
    prepareButton.disabled = false;
    prepareButton.textContent = '重试生成';
    setStatus(`SOS 生成失败：${error.message}`, 'error');
  }
}

export function openSosModal() {
  resetSosModal();
  setModalOpen(true);
}

export function setupSosModal() {
  getEl('sosButton')?.addEventListener('click', openSosModal);
  getEl('prepareSosButton')?.addEventListener('click', prepareSosMessage);
  getEl('closeSosButton')?.addEventListener('click', () => setModalOpen(false));
  getEl('sosModal')?.addEventListener('click', (event) => {
    if (event.target === getEl('sosModal')) {
      setModalOpen(false);
    }
  });
}
