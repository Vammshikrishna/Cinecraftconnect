const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/react-native-quick-crypto/cpp/Cipher/MGLPublicCipher.h');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  let changed = false;

  if (!content.includes('EVP_PKEY_CTX_set_rsa_mgf1_md(ctx.get(), digest)')) {
    const targetBlock = `  if (digest != nullptr) {\n    if (EVP_PKEY_CTX_set_rsa_oaep_md(ctx.get(), digest) <= 0) {\n      return {};\n    }\n  }`;
    const replacement = `  if (digest != nullptr) {\n    if (EVP_PKEY_CTX_set_rsa_oaep_md(ctx.get(), digest) <= 0) {\n      return {};\n    }\n    if (EVP_PKEY_CTX_set_rsa_mgf1_md(ctx.get(), digest) <= 0) {\n      return {};\n    }\n  }`;
    if (content.includes(targetBlock)) {
      content = content.replace(targetBlock, replacement);
      changed = true;
    }
  }

  const targetFailure = `  if (EVP_PKEY_cipher(ctx.get(), out_vec.data(), &out_len, data.data(runtime),\n                      data.size(runtime)) <= 0) {\n    return {};\n  }`;
  const fallbackBlock = `  if (EVP_PKEY_cipher(ctx.get(), out_vec.data(), &out_len, data.data(runtime),\n                      data.size(runtime)) <= 0) {\n    if (operation == kPrivate && padding == RSA_PKCS1_OAEP_PADDING) {\n      EVPKeyCtxPointer fallback_ctx(EVP_PKEY_CTX_new(pkey.get(), nullptr));\n      if (fallback_ctx && EVP_PKEY_cipher_init(fallback_ctx.get()) > 0 &&\n          EVP_PKEY_CTX_set_rsa_padding(fallback_ctx.get(), padding) > 0) {\n        if (digest != nullptr) {\n          EVP_PKEY_CTX_set_rsa_oaep_md(fallback_ctx.get(), digest);\n          EVP_PKEY_CTX_set_rsa_mgf1_md(fallback_ctx.get(), EVP_sha1());\n        }\n        if (EVP_PKEY_cipher(fallback_ctx.get(), out_vec.data(), &out_len,\n                            data.data(runtime), data.size(runtime)) <= 0) {\n          return {};\n        }\n      } else {\n        return {};\n      }\n    } else {\n      return {};\n    }\n  }`;

  if (content.includes(targetFailure)) {
    content = content.replace(targetFailure, fallbackBlock);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-quick-crypto] Successfully patched MGLPublicCipher.h for RSA-OAEP SHA-256 + legacy MGF1 SHA-1 fallback');
  }
}
