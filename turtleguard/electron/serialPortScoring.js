const OFFICIAL_ARDUINO_VENDOR_IDS = new Set(['2341', '2A03']);
const COMMON_USB_SERIAL_VENDOR_IDS = new Set(['1A86', '10C4', '0403']);
const TEXT_DESCRIPTOR_FIELDS = [
  'path',
  'manufacturer',
  'vendorId',
  'productId',
  'product',
  'serialNumber',
  'pnpId',
  'friendlyName',
  'locationId',
];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function scorePort(port, lastSuccessfulPath) {
  const path = normalize(port.path);
  const vendorId = normalize(port.vendorId).toUpperCase();
  const searchText = TEXT_DESCRIPTOR_FIELDS.map((field) => normalize(port[field])).join(' ');

  if (OFFICIAL_ARDUINO_VENDOR_IDS.has(vendorId)) {
    return 100;
  }

  if (searchText.includes('arduino')) {
    return 100;
  }

  if (COMMON_USB_SERIAL_VENDOR_IDS.has(vendorId)) {
    return 80;
  }

  if (
    searchText.includes('ch340') ||
    searchText.includes('ch341') ||
    searchText.includes('cp210') ||
    searchText.includes('ftdi') ||
    searchText.includes('usb serial') ||
    searchText.includes('usb-serial')
  ) {
    return 75;
  }

  if (lastSuccessfulPath && path === normalize(lastSuccessfulPath)) {
    return 70;
  }

  if (path.startsWith('com') || path.includes('/dev/tty') || path.includes('/dev/cu')) {
    return 20;
  }

  return 0;
}

export function sortPortsByArduinoLikelihood(ports, lastSuccessfulPath) {
  return [...ports]
    .map((port) => ({
      ...port,
      score: scorePort(port, lastSuccessfulPath),
    }))
    .sort((a, b) => b.score - a.score || String(a.path).localeCompare(String(b.path)));
}
