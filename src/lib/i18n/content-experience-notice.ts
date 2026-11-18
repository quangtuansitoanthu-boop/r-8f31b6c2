import type { AppLocale } from './translations';

const spiritDreamIds = new Set([
  'pt_drive_69bc37dd604011a70e5c4e38337865a8',
  'pt_drive_c435791b562e6f6e9d345b414df4a273',
  'pt_drive_f72e42f4cbb7db4312f96f4a1f28e2b4',
  'tt_1781081372340_1_xqcxo',
]);
const journeyIds = new Set([
  'tt_1781452671270',
  'tt_1781517395283',
  'pt_drive_74959767068eaae1db4846f62b62eda8',
  'pt_drive_d22e45028d45ede832a28bc87237d5d3',
]);
const hueHienAlbumId = 'pt_1781961851755';
const buddhistJourneyIds = new Set(['phat-tu-thien-dia-du-ky-quyen-1', 'phat-tu-thien-dia-du-ky-quyen-2']);

export function hasContentExperienceNotice(id: string): boolean {
  return spiritDreamIds.has(id) || journeyIds.has(id) || id === hueHienAlbumId || buddhistJourneyIds.has(id);
}

export function contentExperienceNotice(id: string, locale: AppLocale) {
  const kind = spiritDreamIds.has(id) ? 'spiritDreams' : journeyIds.has(id) ? 'journeys' : id === hueHienAlbumId ? 'hueHienDreams' : buddhistJourneyIds.has(id) ? 'buddhistDreams' : null;
  return kind ? { ...copy[locale], message: copy[locale][kind] } : null;
}

const copy = {
  vi: {
    title: 'Lưu ý về nội dung',
    timeout: 'Tự ẩn sau 10 giây',
    spiritDreams: 'Các câu chuyện được kể trong album này đều từ những giấc mơ độ vong của chị Hoa và các anh thầy pháp, đây đều là các trải nghiệm cá nhân, do đó quý vị tin thì quý vị suy ngẫm, không tin xem giải trí ạ',
    journeys: 'Sách này dựa trên trải nghiệm cá nhân trong các giấc mộng của cư sĩ Dương Sinh ở Thánh Hiền đường, quý vị tin thì suy ngẫm, không tin xem giải trí',
    hueHienDreams: 'Các câu chuyện được kể trong album này đều từ những giấc mơ của cư sĩ Thích Nữ Huệ Hiền, đây đều là các trải nghiệm cá nhân, do đó quý vị tin thì quý vị suy ngẫm, không tin xem giải trí ạ',
    buddhistDreams: 'Các câu chuyện được kể trong sách này đều từ những giấc mơ của phật tử, đây đều là các trải nghiệm cá nhân, do đó quý vị tin thì quý vị suy ngẫm, không tin xem giải trí ạ',
  },
  en: {
    title: 'About these stories',
    timeout: 'Disappears after 10 seconds',
    spiritDreams: 'The stories in this album come from Ms Hoa’s and the ritual practitioners’ dreams about helping departed spirits. These are personal experiences, so if you believe them, you are welcome to reflect on them; if not, please enjoy them as entertainment.',
    journeys: 'This book is based on lay practitioner Duong Sinh’s personal dream experiences at Thanh Hien Duong. If you believe them, you are welcome to reflect on them; if not, please enjoy them as entertainment.',
    hueHienDreams: 'The stories in this album come from lay practitioner Thich Nu Hue Hien’s dreams. These are personal experiences, so if you believe them, you are welcome to reflect on them; if not, please enjoy them as entertainment.',
    buddhistDreams: 'The stories in this book come from a Buddhist practitioner’s dreams. These are personal experiences, so if you believe them, you are welcome to reflect on them; if not, please enjoy them as entertainment.',
  },
};
