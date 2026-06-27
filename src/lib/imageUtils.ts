
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from './firebase';

export const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (error) => reject(error);
  });
};

export const uploadToFirebaseStorage = async (fileOrBase64: File | string, folderPath: string = 'uploads'): Promise<string> => {
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const storageRef = ref(storage, `${folderPath}/${filename}`);
  
  try {
    if (typeof fileOrBase64 === 'string') {
      // If it's a data URL/base64 string
      const format = fileOrBase64.split(';')[0].split(':')[1] || 'image/jpeg';
      let cleanBase64 = fileOrBase64;
      if (fileOrBase64.includes(',')) {
        cleanBase64 = fileOrBase64.split(',')[1];
      }
      await uploadString(storageRef, cleanBase64, 'base64', { contentType: format });
    } else {
      // If it's a File object
      await uploadBytes(storageRef, fileOrBase64);
    }
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.warn("Firebase Storage upload failed, falling back to base64 representation:", error);
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(fileOrBase64);
      });
    }
  }
};

