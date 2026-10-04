/**
 * Known-answer tests (section 8): NIST / RFC vectors for hashes, HMAC, AES and PBKDF2,
 * plus round-trips for password hashing, key pairs and file encryption.
 */
import { describe, expect, it } from 'vitest';
import { hashBytes } from '../src/lib/crypto/hash';
import { hmac } from '../src/lib/crypto/hmac';
import { aesDecrypt, aesEncrypt } from '../src/lib/crypto/aes';
import { argon2Check, argon2Hash, bcryptCheck, bcryptHash, pbkdf2Check, pbkdf2Hash } from '../src/lib/crypto/password';
import { generateKeyPair, generatePassword, randomSecret, rsaDecrypt, rsaEncrypt, sign, uuid, verify } from '../src/lib/crypto/keys';
import { decryptFile, encryptFile } from '../src/lib/crypto/fileEncrypt';
import { fromHex, toBase64, toHex, utf8Encode } from '../src/lib/bytes';

describe('FR-K1 hash generator (NIST FIPS 180-4 / 202 vectors)', () => {
  it('hashes "abc"', async () => {
    const r = await hashBytes(utf8Encode('abc'), ['md5', 'sha1', 'sha256', 'sha512', 'sha3-256']);
    expect(toHex(r.md5)).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(toHex(r.sha1)).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(toHex(r.sha256)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(toHex(r.sha512)).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
    expect(toHex(r['sha3-256'])).toBe('3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532');
  });
  it('hashes the empty string', async () => {
    const r = await hashBytes(new Uint8Array(), ['sha256']);
    expect(toHex(r.sha256)).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('CRC32 check value', async () => {
    const r = await hashBytes(utf8Encode('123456789'), ['crc32']);
    expect(toHex(r.crc32)).toBe('cbf43926');
  });
});

describe('FR-K2 HMAC (RFC 4231)', () => {
  it('test case 2', async () => {
    const mac = await hmac('what do ya want for nothing?', 'Jefe', 'text', 'SHA-256');
    expect(toHex(mac)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
  it('accepts hex keys (test case 1)', async () => {
    const mac = await hmac('Hi There', '0b'.repeat(20), 'hex', 'SHA-512');
    expect(toHex(mac)).toBe('87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854');
  });
  it('rejects an empty key', async () => {
    await expect(hmac('x', '', 'text', 'SHA-256')).rejects.toThrow(/key/i);
  });
});

describe('FR-K4 AES', () => {
  it('decrypts the McGrew-Viega GCM test case 2 (zero key/IV)', async () => {
    const packed = toBase64(fromHex('000000000000000000000000' + '0388dace60b6a392f328c2b971b2fe78' + 'ab6e47d42cec13bdf53a67b21257bddf'));
    expect(await aesDecrypt(packed, 'AES-GCM', 128, { kind: 'raw', keyHex: '00'.repeat(16) })).toBe('\0'.repeat(16));
  });
  for (const mode of ['AES-GCM', 'AES-CBC', 'AES-CTR'] as const) {
    it(`${mode} round-trips with a passphrase`, async () => {
      const src = { kind: 'passphrase' as const, passphrase: 'correct horse', iterations: 1000 };
      const enc = await aesEncrypt('नमस्ते 🌏 secret', mode, 256, src);
      expect(await aesDecrypt(enc.packed, mode, 256, src)).toBe('नमस्ते 🌏 secret');
    });
  }
  it('GCM detects a wrong passphrase', async () => {
    const enc = await aesEncrypt('x', 'AES-GCM', 256, { kind: 'passphrase', passphrase: 'a', iterations: 1000 });
    await expect(aesDecrypt(enc.packed, 'AES-GCM', 256, { kind: 'passphrase', passphrase: 'b', iterations: 1000 })).rejects.toThrow(/failed/);
  });
  it('rejects a raw key of the wrong length', async () => {
    await expect(aesEncrypt('x', 'AES-GCM', 256, { kind: 'raw', keyHex: '00'.repeat(16) })).rejects.toThrow(/32 bytes/);
  });
});

describe('FR-K3 password hashing', () => {
  it('PBKDF2-HMAC-SHA256 known answer (password/salt/1)', async () => {
    const dk = toBase64(fromHex('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'), false, false);
    expect(await pbkdf2Check('password', `pbkdf2-sha256$1$${toBase64(utf8Encode('salt'), false, false)}$${dk}`)).toBe(true);
  });
  it('PBKDF2 round-trip and mismatch', async () => {
    const h = await pbkdf2Hash('pa55', 1000, 'SHA-256');
    expect(await pbkdf2Check('pa55', h)).toBe(true);
    expect(await pbkdf2Check('pa56', h)).toBe(false);
  });
  it('bcrypt known vector and round-trip', async () => {
    expect(await bcryptCheck('U*U', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW')).toBe(true);
    const h = await bcryptHash('hunter2', 4);
    expect(await bcryptCheck('hunter2', h)).toBe(true);
    expect(await bcryptCheck('hunter3', h)).toBe(false);
  });
  it('Argon2id round-trip', async () => {
    const h = await argon2Hash('s3cret', { memoryKiB: 1024, iterations: 1, parallelism: 1, hashLength: 16 });
    expect(h.startsWith('$argon2id$v=19$m=1024,t=1,p=1$')).toBe(true);
    expect(await argon2Check('s3cret', h)).toBe(true);
    expect(await argon2Check('nope', h)).toBe(false);
  });
});

describe('FR-K5 / FR-K6 keys', () => {
  it('EC P-256 sign/verify round-trip', async () => {
    const kp = await generateKeyPair('EC-P256');
    expect(kp.publicPem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    const sig = await sign(kp.privatePem, 'ECDSA-P256', 'hello');
    expect(await verify(kp.publicPem, 'ECDSA-P256', 'hello', sig)).toBe(true);
    expect(await verify(kp.publicPem, 'ECDSA-P256', 'hellO', sig)).toBe(false);
  });
  it('RSA keys work for PSS and OAEP', async () => {
    const kp = await generateKeyPair('RSA-2048');
    const sig = await sign(kp.privatePem, 'RSA-PSS', 'doc');
    expect(await verify(kp.publicPem, 'RSA-PSS', 'doc', sig)).toBe(true);
    const ct = await rsaEncrypt(kp.publicPem, 'top secret');
    expect(await rsaDecrypt(kp.privatePem, ct)).toBe('top secret');
  }, 30000);
  it('password generator honours sets and length', () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword({ length: 12, lower: true, upper: true, digits: true, symbols: false, excludeAmbiguous: true });
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/\d/);
      expect(p).not.toMatch(/[O0oIl1]/);
    }
  });
  it('random secrets and UUIDs', () => {
    expect(randomSecret(32, 'hex')).toMatch(/^[0-9a-f]{64}$/);
    expect(uuid(4)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid(7)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });
});

describe('FR-K7 file encryption', () => {
  it('round-trips and detects tampering', async () => {
    const data = utf8Encode('file contents '.repeat(1000));
    const enc = await encryptFile(data, 'long password', 1000);
    expect(await decryptFile(enc, 'long password')).toEqual(data);
    await expect(decryptFile(enc, 'wrong password')).rejects.toThrow(/Wrong password/);
    const tampered = enc.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptFile(tampered, 'long password')).rejects.toThrow();
    const badHeader = enc.slice();
    badHeader[12] ^= 1; // salt is authenticated as AAD
    await expect(decryptFile(badHeader, 'long password')).rejects.toThrow();
  });
});
