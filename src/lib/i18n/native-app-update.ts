export const nativeAppUpdateText = {
  vi: {
    title: (version: string) => `Tu tập Phật pháp · Bản mới ${version}`,
    message: 'Vui lòng cập nhật để sửa lỗi các tính năng và nâng cao trải nghiệm tu tập.',
    later: 'Để sau',
    update: 'Cập nhật',
    storeFailed: (name: string) => `Chưa mở được ${name}. Hãy thử lại hoặc chọn Để sau.`,
  },
  en: {
    title: (version: string) => `Tu Tap - Buddhist Practice v${version}`,
    message: 'Please update for bug fixes and a better experience with your daily practice.',
    later: 'Later',
    update: 'Update',
    storeFailed: (name: string) => `Could not open ${name}. Try again or choose Later.`,
  },
};
