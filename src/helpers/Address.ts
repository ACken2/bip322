// Import dependency
import { ec as EC } from 'elliptic';
import * as bitcoin from 'bitcoinjs-lib';

/**
 * Class that implement address-related utility functions.
 */
class Address {

    /**
     * Check if a given Bitcoin address is a pay-to-public-key-hash (p2pkh) address.
     * @param address Bitcoin address to be checked
     * @returns True if the provided address correspond to a valid P2PKH address, false if otherwise
     */
    public static isP2PKH(address: string) {
        // Check if the provided address is a P2PKH address
        if (address[0] === '1' || address[0] === 'm' || address[0] === 'n') {
            return true; // P2PKH address
        }
        else {
            return false;
        }
    }

    /**
     * Check if a given Bitcoin address is a pay-to-script-hash (P2SH) address.
     * @param address Bitcoin address to be checked
     * @returns True if the provided address correspond to a valid P2SH address, false if otherwise
     */
    public static isP2SH(address: string) {
        // Check if the provided address is a P2SH address
        if (address[0] === '3' || address[0] === '2') {
            return true; // P2SH address
        }
        else {
            return false;
        }
    }

    /**
     * Check if a given Bitcoin address is a pay-to-witness-public-key-hash (P2WPKH) address.
     * @param address Bitcoin address to be checked
     * @returns True if the provided address correspond to a valid P2WPKH address, false if otherwise
     */
    public static isP2WPKH(address: string) {
        // Check if the provided address is a P2WPKH/P2WSH address
        if (address.slice(0, 4) === 'bc1q' || address.slice(0, 4) === 'tb1q') {
            // Either a P2WPKH / P2WSH address
            // Convert the address into a scriptPubKey
            const scriptPubKey = this.convertAdressToScriptPubkey(address);
            // Check if the scriptPubKey is exactly 22 bytes since P2WPKH scriptPubKey should be 0014<20-BYTE-PUBKEY-HASH>
            if (scriptPubKey.byteLength === 22) {
                return true; // P2WPKH
            }
            else {
                return false; // Not P2WPKH, probably P2WSH
            }
        }
        else {
            return false;
        }
    }

    /**
     * Check if a given Bitcoin address is a taproot address.
     * @param address Bitcoin address to be checked
     * @returns True if the provided address is a taproot address, false if otherwise
     */
    public static isP2TR(address: string) {
        if (address.slice(0, 4) === 'bc1p' || address.slice(0, 4) === 'tb1p') {
            return true; // P2TR address
        }
        else {
            return false;
        }
    }

    /**
     * Check if a given witness stack corresponds to a P2WPKH address.
     * @param witness Witness data associated with the toSign BIP-322 transaction
     * @returns True if the provided witness stack correspond to a valid P2WPKH address, false if otherwise
     */
    public static isP2WPKHWitness(witness: Buffer[]) {
        // Check whether the witness stack is as expected for a P2WPKH address
        // It should contain exactly two items, with the second item being a public key with 33 bytes, and the first byte must be either 0x02/0x03
        if (witness.length === 2 && witness[1].byteLength === 33 && (witness[1][0] === 0x02 || witness[1][0] === 0x03)) {
            return true;
        }
        else {
            return false;
        }
    }

    /**
     * Check if a given witness stack corresponds to a single-key-spend P2TR address.
     * @param witness Witness data associated with the toSign BIP-322 transaction
     * @returns True if the provided address and witness stack correspond to a valid single-key-spend P2TR address, false if otherwise
     */
    public static isSingleKeyP2TRWitness(witness: Buffer[]) {
        // Check whether the witness stack is as expected for a single-key-spend taproot address
        // It should contain exactly one items which is the signature for the transaction
        if (witness.length === 1) {
            return true;
        }
        else {
            return false;
        }
    }

    /**
     * Convert a given Bitcoin address into its corresponding script public key.
     * Reference: https://github.com/buidl-bitcoin/buidl-python/blob/d79e9808e8ca60975d315be41293cb40d968626d/buidl/script.py#L607
     * @param address Bitcoin address
     * @returns Script public key of the given Bitcoin address
     * @throws Error when the provided address is not a valid Bitcoin address
     */
    public static convertAdressToScriptPubkey(address: string) {
        if (address[0] === '1' || address[0] === 'm' || address[0] === 'n') {
            // P2PKH address
            return bitcoin.payments.p2pkh({
                address: address,
                network: (address[0] === '1') ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
            }).output as Buffer;
        }
        else if (address[0] === '3' || address[0] === '2') {
            // P2SH address
            return bitcoin.payments.p2sh({
                address: address,
                network: (address[0] === '3') ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
            }).output as Buffer;
        }
        else if (address.slice(0, 4) === 'bc1q' || address.slice(0, 4) === 'tb1q') {
            // P2WPKH or P2WSH address
            if (address.length === 42) {
                // P2WPKH address
                return bitcoin.payments.p2wpkh({
                    address: address,
                    network: (address.slice(0, 4) === 'bc1q') ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
                }).output as Buffer;
            }
            else if (address.length === 62) {
                // P2WSH address
                return bitcoin.payments.p2wsh({
                    address: address,
                    network: (address.slice(0, 4) === 'bc1q') ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
                }).output as Buffer;
            }
        }
        else if (address.slice(0, 4) === 'bc1p' || address.slice(0, 4) === 'tb1p') {
            if (address.length === 62) {
                // P2TR address
                return bitcoin.payments.p2tr({
                    address: address,
                    network: (address.slice(0, 4) === 'bc1p') ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
                }).output as Buffer;
            }
        }
        throw new Error("Unknown address type");
    }

    /**
     * Convert a given public key into a corresponding Bitcoin address.
     * @param publicKey Public key for deriving the address, or internal public key for deriving taproot address
     * @param addressType Bitcoin address type to be derived, must be either 'p2pkh', 'p2sh-p2wpkh', 'p2wpkh', or 'p2tr'
     * @returns Bitcoin address that correspond to the given public key in both mainnet and testnet
     */
    public static convertPubKeyIntoAddress(publicKey: Buffer, addressType: 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh' | 'p2tr') {
        switch (addressType) {
            case 'p2pkh':
                return {
                    mainnet: bitcoin.payments.p2pkh({ pubkey: publicKey, network: bitcoin.networks.bitcoin }).address,
                    testnet: bitcoin.payments.p2pkh({ pubkey: publicKey, network: bitcoin.networks.testnet }).address
                }
            case 'p2sh-p2wpkh':
                // Reference: https://github.com/bitcoinjs/bitcoinjs-lib/blob/1a9119b53bcea4b83a6aa8b948f0e6370209b1b4/test/integration/addresses.spec.ts#L70
                return {
                    mainnet: bitcoin.payments.p2sh({ 
                        redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey, network: bitcoin.networks.bitcoin }), 
                        network: bitcoin.networks.bitcoin 
                    }).address,
                    testnet: bitcoin.payments.p2sh({ 
                        redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey, network: bitcoin.networks.testnet }), 
                        network: bitcoin.networks.testnet 
                    }).address
                }
            case 'p2wpkh':
                return {
                    mainnet: bitcoin.payments.p2wpkh({ pubkey: publicKey, network: bitcoin.networks.bitcoin }).address,
                    testnet: bitcoin.payments.p2wpkh({ pubkey: publicKey, network: bitcoin.networks.testnet }).address
                }
            case 'p2tr':
                // Convert full-length public key into internal public key if necessary
                const internalPubkey = publicKey.byteLength === 33 ? publicKey.subarray(1, 33) : publicKey;
                return {
                    mainnet: bitcoin.payments.p2tr({ internalPubkey: internalPubkey, network: bitcoin.networks.bitcoin }).address,
                    testnet: bitcoin.payments.p2tr({ internalPubkey: internalPubkey, network: bitcoin.networks.testnet }).address
                }
            default:
                throw new Error('Cannot convert public key into unsupported address type.');
        }
    }

    /**
     * Validates a given Bitcoin address.
     * This method checks if the provided Bitcoin address is valid by attempting to decode it
     * for different Bitcoin networks: mainnet, testnet, and regtest. The method uses the
     * bitcoinjs-lib's address module for decoding.
     * 
     * The process is as follows:
     * 1. Attempt to decode the address for the Bitcoin mainnet. If decoding succeeds,
     *    the method returns true, indicating the address is valid for mainnet.
     * 2. If the first step fails, catch the resulting error and attempt to decode the
     *    address for the Bitcoin testnet. If decoding succeeds, the method returns true,
     *    indicating the address is valid for testnet.
     * 3. If the second step fails, catch the resulting error and attempt to decode the
     *    address for the Bitcoin regtest network. If decoding succeeds, the method returns
     *    true, indicating the address is valid for regtest.
     * 4. If all attempts fail, the method returns false, indicating the address is not valid
     *    for any of the checked networks.
     * 
     * @param address The Bitcoin address to validate.
     * @return boolean Returns true if the address is valid for any of the Bitcoin networks,
     *                 otherwise returns false.
     */
    public static isValidBitcoinAddress(address: string): boolean {
        try {
            // Attempt to decode the address using bitcoinjs-lib's address module at mainnet
            bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
            return true; // If decoding succeeds, the address is valid
        } 
        catch (error) { }
        try {
            // Attempt to decode the address using bitcoinjs-lib's address module at testnet
            bitcoin.address.toOutputScript(address, bitcoin.networks.testnet);
            return true; // If decoding succeeds, the address is valid
        }
        catch (error) { }
        try {
            // Attempt to decode the address using bitcoinjs-lib's address module at regtest
            bitcoin.address.toOutputScript(address, bitcoin.networks.regtest);
            return true; // If decoding succeeds, the address is valid
        }
        catch (error) { }
        return false; // Probably not a valid address
    }

    /**
     * Compresses an uncompressed public key using the elliptic curve secp256k1.
     * This method takes a public key in its uncompressed form and returns a compressed
     * representation of the public key. Elliptic curve public keys can be represented in 
     * a shorter form known as compressed format which saves space and still retains the 
     * full public key's capabilities. The method uses the elliptic library to convert the
     * uncompressed public key into its compressed form.
     * 
     * The steps involved in the process are:
     * 1. Initialize a new elliptic curve instance for the secp256k1 curve.
     * 2. Create a key pair object from the uncompressed public key buffer.
     * 3. Extract the compressed public key from the key pair object.
     * 4. Return the compressed public key as a Buffer object.
     * 
     * @param uncompressedPublicKey A Buffer containing the uncompressed public key.
     * @return Buffer Returns a Buffer containing the compressed public key.
     * @throws Error Throws an error if the provided public key cannot be compressed,
     *         typically indicating that the key is not valid.
     */
    public static compressPublicKey(uncompressedPublicKey: Buffer): Buffer {
        // Initialize elliptic curve
        const ec = new EC('secp256k1');
        // Try to compress the provided public key
        try {
            // Create a key pair from the uncompressed public key buffer
            const keyPair = ec.keyFromPublic(Buffer.from(uncompressedPublicKey));
            // Get the compressed public key as a Buffer
            const compressedPublicKey = Buffer.from(keyPair.getPublic(true, 'array'));
            return compressedPublicKey;
        }
        catch (err) {
            throw new Error('Fails to compress the provided public key. Please check if the provided key is a valid uncompressed public key.');
        }
    }

    /**
     * Uncompresses a given public key using the elliptic curve secp256k1.
     * This method accepts a compressed public key and attempts to convert it into its
     * uncompressed form. Public keys are often compressed to save space, but certain
     * operations require the full uncompressed key. This method uses the elliptic
     * library to perform the conversion.
     *
     * The function operates as follows:
     * 1. Initialize a new elliptic curve instance using secp256k1.
     * 2. Attempt to create a key pair from the compressed public key buffer.
     * 3. Extract the uncompressed public key from the key pair object.
     * 4. Return the uncompressed public key as a Buffer object.
     * If the compressed public key provided is invalid and cannot be uncompressed, 
     * the method will throw an error with a descriptive message.
     * 
     * @param compressedPublicKey A Buffer containing the compressed public key.
     * @return Buffer The uncompressed public key as a Buffer.
     * @throws Error Throws an error if the provided public key cannot be uncompressed,
     *         typically indicating that the key is not valid.
     */
    public static uncompressPublicKey(compressedPublicKey: Buffer): Buffer {
        // Initialize elliptic curve
        const ec = new EC('secp256k1');
        // Try to uncompress the provided public key
        try {
            // Create a key pair from the compressed public key buffer
            const keyPair = ec.keyFromPublic(Buffer.from(compressedPublicKey));
            // Get the compressed public key as a Buffer
            const uncompressedPublicKey = Buffer.from(keyPair.getPublic(false, 'array'));
            return uncompressedPublicKey;
        }
        catch (err) {
            throw new Error('Fails to uncompress the provided public key. Please check if the provided key is a valid compressed public key.');
        }
    }

}

export default Address;