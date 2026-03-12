// ===================== CRYPTO-LOCAL.JS =====================
const CryptoManager = (() => {
  function encrypt(text, password) {
    if (!password) return text;
    try {
      return CryptoJS.AES.encrypt(text, password).toString();
    } catch (e) {
      console.error('Encrypt error:', e);
      return text;
    }
  }

  function decrypt(ciphertext, password) {
    if (!password) return ciphertext;
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || ciphertext;
    } catch (e) {
      console.error('Decrypt error:', e);
      return ciphertext;
    }
  }

  function isEncrypted(text) {
    return text && text.startsWith('U2FsdGVkX1');
  }

  return { encrypt, decrypt, isEncrypted };
})();
