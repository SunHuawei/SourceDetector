import CryptoJS from 'crypto-js';

/**
 * Strips CRX headers from zip
 * @param arraybuffer - CRX file data
 * @returns Promise that resolves with the ZIP blob and public key
 */
export function crxToZip(arraybuffer: ArrayBuffer): Promise<{ zip: Blob; publicKey: string | undefined }> {
    return new Promise((resolve, reject) => {
        // Definition of crx format: http://developer.chrome.com/extensions/crx.html
        const view = new Uint8Array(arraybuffer);

        // 50 4b 03 04
        if (view[0] === 80 && view[1] === 75 && view[2] === 3 && view[3] === 4) {
            console.warn('Input is not a CRX file, but a ZIP file.');
            resolve({ zip: new Blob([arraybuffer], { type: 'application/zip' }), publicKey: undefined });
            return;
        }

        // 43 72 32 34
        if (view[0] !== 67 || view[1] !== 114 || view[2] !== 50 || view[3] !== 52) {
            if (isMaybeZipData(view)) {
                console.warn('Input is not a CRX file, but possibly a ZIP file.');
                resolve({ zip: new Blob([arraybuffer], { type: 'application/zip' }), publicKey: undefined });
                return;
            }
            reject(new Error('Invalid header: Does not start with Cr24.'));
            return;
        }

        // 02 00 00 00
        // 03 00 00 00 CRX3
        if (view[4] !== 2 && view[4] !== 3 || view[5] || view[6] || view[7]) {
            reject(new Error('Unexpected crx format version number.'));
            return;
        }

        let zipStartOffset: number;
        let publicKeyBase64: string | undefined;

        if (view[4] === 2) {
            const publicKeyLength = calcLength(view[8], view[9], view[10], view[11]);
            const signatureLength = calcLength(view[12], view[13], view[14], view[15]);
            // 16 = Magic number (4), CRX format version (4), lengths (2x4)
            zipStartOffset = 16 + publicKeyLength + signatureLength;

            // Public key
            publicKeyBase64 = btoa(getBinaryString(view, 16, 16 + publicKeyLength));
        } else { // view[4] === 3
            // CRX3 - https://cs.chromium.org/chromium/src/components/crx_file/crx3.proto
            const crx3HeaderLength = calcLength(view[8], view[9], view[10], view[11]);
            // 12 = Magic number (4), CRX format version (4), header length (4)
            zipStartOffset = 12 + crx3HeaderLength;

            // Public key
            publicKeyBase64 = getPublicKeyFromProtoBuf(view, 12, zipStartOffset);
        }

        // addons.opera.com creates CRX3 files by prepending the CRX3 header to the CRX2 data.
        if (
            // CRX3
            view[4] === 3 &&
            // 43 72 32 34 - Cr24 = CRX magic
            view[zipStartOffset + 0] === 67 &&
            view[zipStartOffset + 1] === 114 &&
            view[zipStartOffset + 2] === 50 &&
            view[zipStartOffset + 3] === 52
        ) {
            console.warn('Nested CRX: Expected zip data, but found another CRX file instead.');
            return crxToZip(arraybuffer.slice(zipStartOffset))
                .then(({ zip, publicKey: nestedKey }) => {
                    if (publicKeyBase64 !== nestedKey) {
                        console.warn('Nested CRX: pubkey mismatch; found ' + nestedKey);
                    }
                    resolve({ zip, publicKey: publicKeyBase64 });
                })
                .catch(reject);
        }

        // Create a new view for the existing buffer, and wrap it in a Blob object.
        const zipFragment = new Blob([
            new Uint8Array(arraybuffer, zipStartOffset)
        ], {
            type: 'application/zip'
        });
        resolve({ zip: zipFragment, publicKey: publicKeyBase64 });
    });
}

function calcLength(a: number, b: number, c: number, d: number): number {
    let length = 0;
    length += a << 0;
    length += b << 8;
    length += c << 16;
    length += d << 24 >>> 0;
    return length;
}

function getBinaryString(bytesView: Uint8Array, startOffset: number, endOffset: number): string {
    let binaryString = '';
    for (let i = startOffset; i < endOffset; ++i) {
        binaryString += String.fromCharCode(bytesView[i]);
    }
    return binaryString;
}

function getPublicKeyFromProtoBuf(bytesView: Uint8Array, startOffset: number, endOffset: number): string | undefined {
    function getvarint(): number {
        let val = bytesView[startOffset] & 0x7F;
        if (bytesView[startOffset++] < 0x80) return val;
        val |= (bytesView[startOffset] & 0x7F) << 7;
        if (bytesView[startOffset++] < 0x80) return val;
        val |= (bytesView[startOffset] & 0x7F) << 14;
        if (bytesView[startOffset++] < 0x80) return val;
        val |= (bytesView[startOffset] & 0x7F) << 21;
        if (bytesView[startOffset++] < 0x80) return val;
        val = (val | (bytesView[startOffset] & 0xF) << 28) >>> 0;
        if (bytesView[startOffset++] & 0x80) console.warn('proto: not a uint32');
        return val;
    }

    const publicKeys: string[] = [];
    let crxIdBin: Uint8Array | undefined;

    while (startOffset < endOffset) {
        const key = getvarint();
        const length = getvarint();
        if (key === 80002) { // This is ((10000 << 3) | 2) (signed_header_data).
            const sigdatakey = getvarint();
            const sigdatalen = getvarint();
            if (sigdatakey !== 0xA) {
                console.warn('proto: Unexpected key in signed_header_data: ' + sigdatakey);
            } else if (sigdatalen !== 16) {
                console.warn('proto: Unexpected signed_header_data length ' + length);
            } else if (crxIdBin) {
                console.warn('proto: Unexpected duplicate signed_header_data');
            } else {
                crxIdBin = bytesView.subarray(startOffset, startOffset + 16);
            }
            startOffset += sigdatalen;
            continue;
        }
        if (key !== 0x12) {
            // Likely 0x1a (sha256_with_ecdsa).
            if (key !== 0x1a) {
                console.warn('proto: Unexpected key: ' + key);
            }
            startOffset += length;
            continue;
        }
        // Found 0x12 (sha256_with_rsa); Look for 0xA (public_key).
        const keyproofend = startOffset + length;
        let keyproofkey = getvarint();
        let keyprooflength = getvarint();
        // AsymmetricKeyProof could contain 0xA (public_key) or 0x12 (signature).
        if (keyproofkey === 0x12) {
            startOffset += keyprooflength;
            if (startOffset >= keyproofend) {
                // signature without public_key...? The protocol definition allows it...
                continue;
            }
            keyproofkey = getvarint();
            keyprooflength = getvarint();
        }
        if (keyproofkey !== 0xA) {
            startOffset += keyprooflength;
            console.warn('proto: Unexpected key in AsymmetricKeyProof: ' + keyproofkey);
            continue;
        }
        if (startOffset + keyprooflength > endOffset) {
            console.warn('proto: size of public_key field is too large');
            break;
        }
        // Found 0xA (public_key).
        publicKeys.push(getBinaryString(bytesView, startOffset, startOffset + keyprooflength));
        startOffset = keyproofend;
    }

    if (!publicKeys.length) {
        console.warn('proto: Did not find any public key');
        return undefined;
    }
    if (!crxIdBin) {
        console.warn('proto: Did not find crx_id');
        return undefined;
    }

    const crxIdHex = CryptoJS.enc.Latin1.parse(getBinaryString(crxIdBin, 0, 16)).toString();
    for (const publicKey of publicKeys) {
        const sha256sum = CryptoJS.SHA256(CryptoJS.enc.Latin1.parse(publicKey)).toString();
        if (sha256sum.slice(0, 32) === crxIdHex) {
            return btoa(publicKey);
        }
    }
    console.warn('proto: None of the public keys matched with crx_id');
    return undefined;
}

function isMaybeZipData(view: Uint8Array): boolean {
    // Find EOCD (0xFFFF is the maximum size of an optional trailing comment).
    for (let i = view.length - 22, ii = Math.max(0, i - 0xFFFF); i >= ii; --i) {
        if (view[i] === 0x50 && view[i + 1] === 0x4b &&
            view[i + 2] === 0x05 && view[i + 3] === 0x06) {
            return true;
        }
    }
    return false;
} 