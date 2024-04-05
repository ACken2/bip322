// Import dependencies
import { expect } from 'chai';
import BIP322 from "../src/BIP322";
import ECPairFactory from 'ecpair';
import { Witness } from '../src/helpers';
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';

// Import module to be tested
import { Verifier } from '../src';

/**
 * Given a valid BIP-137 signature, generate compatible valid signatures with different header flag.
 *
 * In BIP-137 signature scheme, only the recId, which is a number from 0 - 3 inclusive, is a part of the
 * signature. The header is composed of the recId and a constant which indicates address type.
 * 
 * Based on this library's concept of "proving that you own a private key, proves that you own all associated address",
 * this function is used to generate compatible signatures with different address type regardless of the address type
 * indicated in the BIP-137 signature.
 *
 * @param {string} base64Signature - The base64 signature string to be modified.
 * @param {number} start - The start of the decimal range for the header constant, defaults to 27 for P2PKH uncompressed address.
 * @param {number} end - The end of the decimal range for the header constant, defaults to 42 for Segwit Bech32 address.
 * @returns {string[]} An array of compatible base64 encoded signatures.
 */
function generateCompatibleSignatures(base64Signature: string, start: number = 27, end: number = 42): string[] {
    // Decode the base64 string to a Buffer
    let buffer = Buffer.from(base64Signature, 'base64');
    // Array for storing compatible signatures
    const modifiedBase64Strings: string[] = [];
    // Obtain the initial recId in the given signature
    const initialRecId = buffer[0];
    // Loop through the range and replace the first byte
    for (let i = start; i <= end; i++) {
        // Only header with a difference of the multiple of 4 is compatible since recId is a number from 0 - 3
        // For example, if initialRecId is 32, then only 28, 36, 40 are compatible
        if (Math.abs(i - initialRecId) % 4 == 0) {
            // Copy the buffer to avoid modifying the original data
            let modifiedBuffer = Buffer.from(buffer);
            // Replace the first byte with the current value in the range
            modifiedBuffer[0] = i;
            // Encode the modified buffer back to a base64 string and add to the result array
            modifiedBase64Strings.push(modifiedBuffer.toString('base64'));
        }
    }
    return modifiedBase64Strings;
}

// Tests
describe('Verifier Test', () => {

    it('Can verify legacy P2PKH signature', () => {
        // Arrange
        // Test vector copied from https://github.com/bitcoinjs/bitcoinjs-message/blob/c43430f4c03c292c719e7801e425d887cbdf7464/README.md?plain=1#L21
        const address = "1F3sAm6ZtwLAUnj7d38pGFxtP3RVEvtsbV";
        const addressTestnet = 'muZpTpBYhxmRFuCjLc7C6BBDF32C8XVJUi';
        const addressWrong = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
        const addressWrongTestnet = 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn';
        const message = "This is an example of a signed message.";
        const messageWrong = "";
        const signature = "H9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=";

        // Act
        const resultCorrect = Verifier.verifySignature(address, message, signature); // Everything correct
        const resultCorrectTestnet = Verifier.verifySignature(addressTestnet, message, signature); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signature); // Wrong message - should be false
        const resultWrongMessageTestnet = Verifier.verifySignature(addressTestnet, messageWrong, signature); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, message, signature); // Wrong address - should be false
        const resultWrongAddressTestnet = Verifier.verifySignature(addressWrongTestnet, message, signature); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultCorrectTestnet).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongMessageTestnet).to.be.false;
        expect(resultWrongAddress).to.be.false;
        expect(resultWrongAddressTestnet).to.be.false;
    });

    it('Can verify legacy BIP-137 signature from P2SH-P2WPKH, P2WPKH, and P2TR address', () => {
        // Arrange
        const message = 'Hello World';
        // Signed by public key "02f7fb07050d858b3289c2a0305fbac1f5b18233798665c0cbfe133e018b57cafc" using header 32
        const signatureBase = 'IAtVrymJqo43BCt9f7Dhl6ET4Gg3SmhyvdlW6wn9iWc9PweD7tNM5+qw7xE9/bzlw/Et789AQ2F59YKEnSzQudo=';
        const signatures = generateCompatibleSignatures(signatureBase, 27, 42); // Range of header range that is in-spec with BIP-137
        expect(signatures).to.include(signatureBase, "Error in generating signatures with different flags!");
        // Addresses derived from uncompressed public key "04f7fb07050d858b3289c2a0305fbac1f5b18233798665c0cbfe133e018b57cafc96668ad9ba5d1b2e9db47ecd5e2b484f9b955740dcabbe61d886d0ee6f5dc1b8"
        const p2pkhMainnetValidUncompress = "1Nji71ru2dMty4CPGNoXsqoU4byok8toqm";
        const p2pkhTestnetValidUncompress = "n3FfQ4wsqeo9kAfzywmuhm1nvbaWc4TpvC";
        // Addresses derived from public key "02f7fb07050d858b3289c2a0305fbac1f5b18233798665c0cbfe133e018b57cafc"
        const p2pkhMainnetValid = "1QDZfWJTVXqHFmJFRkyrnidvHyPyG5bynY";
        const p2pkhTestnetValid = "n4jWxZPSJZGY2sms9KxEcdrF9xzgEbrHHj";
        const p2shMainnetValid = "36mTiayp1ZCcMr8t8KDdnVGSiz7Pd1cNie";
        const p2shTestnetValid = "2MxKfnKuqd1hxZdmRoSqWQSFhwLKZRQ3NpZ";
        const p2wpkhMainnetValid = "bc1ql64jd2pewssuuehu6g7kh6ud54amq5n8t95eeq";
        const p2wpkhTestnetValid = "tb1ql64jd2pewssuuehu6g7kh6ud54amq5n8pr02zn";
        const p2trMainnetValid = "bc1p5tm5kzqpflhxkkzhl7x4f0nnfygp38hxz4erdq4ffhpqgmgket9s34fgdd";
        const p2trTestnetValid = "tb1p5tm5kzqpflhxkkzhl7x4f0nnfygp38hxz4erdq4ffhpqgmgket9sxal8hz";
        // Random address that should fail validation
        const p2pkhMainnetInvalid = "1F3sAm6ZtwLAUnj7d38pGFxtP3RVEvtsbV";
        const p2pkhTestnetInvalid = "muZpTpBYhxmRFuCjLc7C6BBDF32C8XVJUi";
        const p2shMainnetInvalid = "3HSVzEhCFuH9Z3wvoWTexy7BMVVp3PjS6f";
        const p2shTestnetInvalid = "2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc";
        const p2wpkhMainnetInvalid = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        const p2wpkhTestnetInvalid = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
        const p2trMainnetInvalid = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const p2trTestnetInvalid = "tb1p000273lqsqqfw2a6h2vqxr2tll4wgtv7zu8a30rz4mhree8q5jzq8cjtyp";

        // Act
        for (let signature of signatures) {

            const p2pkhMainnetValidUncompressResult = Verifier.verifySignature(p2pkhMainnetValidUncompress, message, signature);
            const p2pkhTestnetValidUncompressResult = Verifier.verifySignature(p2pkhTestnetValidUncompress, message, signature);
            const p2pkhMainnetValidResult = Verifier.verifySignature(p2pkhMainnetValid, message, signature);
            const p2pkhTestnetValidResult = Verifier.verifySignature(p2pkhTestnetValid, message, signature);
            const p2shMainnetValidResult = Verifier.verifySignature(p2shMainnetValid, message, signature);
            const p2shTestnetValidResult = Verifier.verifySignature(p2shTestnetValid, message, signature);
            const p2wpkhMainnetValidResult = Verifier.verifySignature(p2wpkhMainnetValid, message, signature);
            const p2wpkhTestnetValidResult = Verifier.verifySignature(p2wpkhTestnetValid, message, signature);
            const p2trMainnetValidResult = Verifier.verifySignature(p2trMainnetValid, message, signature);
            const p2trTestnetValidResult = Verifier.verifySignature(p2trTestnetValid, message, signature);

            const p2pkhMainnetInvalidResult = Verifier.verifySignature(p2pkhMainnetInvalid, message, signature);
            const p2pkhTestnetInvalidResult = Verifier.verifySignature(p2pkhTestnetInvalid, message, signature);
            const p2shMainnetInvalidResult = Verifier.verifySignature(p2shMainnetInvalid, message, signature);
            const p2shTestnetInvalidResult = Verifier.verifySignature(p2shTestnetInvalid, message, signature);
            const p2wpkhMainnetInvalidResult = Verifier.verifySignature(p2wpkhMainnetInvalid, message, signature);
            const p2wpkhTestnetInvalidResult = Verifier.verifySignature(p2wpkhTestnetInvalid, message, signature);
            const p2trMainnetInvalidResult = Verifier.verifySignature(p2trMainnetInvalid, message, signature);
            const p2trTestnetInvalidResult = Verifier.verifySignature(p2trTestnetInvalid, message, signature);

            // Assert
            expect(p2pkhMainnetValidUncompressResult).to.be.true;
            expect(p2pkhTestnetValidUncompressResult).to.be.true;
            expect(p2pkhMainnetValidResult).to.be.true;
            expect(p2pkhTestnetValidResult).to.be.true;
            expect(p2shMainnetValidResult).to.be.true;
            expect(p2shTestnetValidResult).to.be.true;
            expect(p2wpkhMainnetValidResult).to.be.true;
            expect(p2wpkhTestnetValidResult).to.be.true;
            expect(p2trMainnetValidResult).to.be.true;
            expect(p2trTestnetValidResult).to.be.true;

            expect(p2pkhMainnetInvalidResult).to.be.false;
            expect(p2pkhTestnetInvalidResult).to.be.false;
            expect(p2shMainnetInvalidResult).to.be.false;
            expect(p2shTestnetInvalidResult).to.be.false;
            expect(p2wpkhMainnetInvalidResult).to.be.false;
            expect(p2wpkhTestnetInvalidResult).to.be.false;
            expect(p2trMainnetInvalidResult).to.be.false;
            expect(p2trTestnetInvalidResult).to.be.false;

        }
    });

    it('Can verify and falsify BIP-322 signature for P2SH-P2WPKH address', () => {
        // Arrange
        // Constants
        const privateKey = "KwTbAxmBXjoZM3bzbXixEr9nxLhyYSM4vp2swet58i19bw9sqk5z"; // Private key of "3HSVzEhCFuH9Z3wvoWTexy7BMVVp3PjS6f", also serve to test public key that begins with 0x03
        const address = "3HSVzEhCFuH9Z3wvoWTexy7BMVVp3PjS6f"; // Derived from the private key above
        const addressTestnet = '2N8zi3ydDsMnVkqaUUe5Xav6SZqhyqEduap'; // Derived from the private key above
        const addressWrong = "342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey";
        const addressTestnetWrong = '2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc';
        const messageWrong = "";
        const messageHelloWorld = "Hello World";
        // Initialize private key used to sign the transaction
        const ECPair = ECPairFactory(ecc);
        const testPrivateKey = ECPair.fromWIF(privateKey);
        // Obtain the script public key
        const scriptPubKey = bitcoin.payments.p2sh({
			address: address
		}).output as Buffer;
        // Derive the P2SH-P2WPKH redeemScript from the corresponding hashed public key
        const redeemScript = bitcoin.payments.p2wpkh({
			hash: bitcoin.crypto.hash160(testPrivateKey.publicKey)
		}).output as Buffer;
        // Draft a toSpend transaction with messageHelloWorld
        const toSpendTx = BIP322.buildToSpendTx(messageHelloWorld, scriptPubKey);
        // Draft a toSign transaction that spends toSpend transaction
        const toSignTx = BIP322.buildToSignTx(toSpendTx.getId(), redeemScript, true);
        // Sign the toSign transaction
        const toSignTxSigned = toSignTx.signAllInputs(testPrivateKey).finalizeAllInputs();
        // Extract the signature
        const signature = BIP322.encodeWitness(toSignTxSigned);

        // Act
        const resultCorrect = Verifier.verifySignature(address, messageHelloWorld, signature); // Everything correct
        const resultCorrectTestnet = Verifier.verifySignature(addressTestnet, messageHelloWorld, signature); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signature); // Wrong message - should be false
        const resultWrongMessageTestnet = Verifier.verifySignature(addressTestnet, messageWrong, signature); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signature); // Wrong address - should be false
        const resultWrongAddressTestnet = Verifier.verifySignature(addressTestnetWrong, messageHelloWorld, signature); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultCorrectTestnet).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongMessageTestnet).to.be.false;
        expect(resultWrongAddress).to.be.false;
        expect(resultWrongAddressTestnet).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for P2WPKH address', () => {
        // Arrange
        // Test vectors listed at https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki#user-content-Test_vectors
        const address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        const addressTestnet = 'tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v';
        const addressWrong = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
        const addressWrongTestnet = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
        const messageEmpty = "";
        const messageHelloWorld = "Hello World";
        const signatureEmpty = "AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=";
        const signatureHelloWorld = "AkcwRAIgZRfIY3p7/DoVTty6YZbWS71bc5Vct9p9Fia83eRmw2QCICK/ENGfwLtptFluMGs2KsqoNSk89pO7F29zJLUx9a/sASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=";
        // Additional test vector listed at https://github.com/bitcoin/bitcoin/blob/29b28d07fa958b89e1c7916fda5d8654474cf495/src/test/util_tests.cpp#L2713
        const signatureHelloWorldAlt = "AkgwRQIhAOzyynlqt93lOKJr+wmmxIens//zPzl9tqIOua93wO6MAiBi5n5EyAcPScOjf1lAqIUIQtr3zKNeavYabHyR8eGhowEhAsfxIAMZZEKUPYWI4BruhAQjzFT8FSFSajuFwrDL1Yhy";
        
        // Act
        // Correct addresses and correct signature
        const resultEmptyValid = Verifier.verifySignature(address, messageEmpty, signatureEmpty);
        const resultEmptyValidTestnet = Verifier.verifySignature(addressTestnet, messageEmpty, signatureEmpty);
        const resultHelloWorldValid = Verifier.verifySignature(address, messageHelloWorld, signatureHelloWorld);
        const resultHelloWorldValidTestnet = Verifier.verifySignature(addressTestnet, messageHelloWorld, signatureHelloWorld);
        const resultHelloWorldValidII =  Verifier.verifySignature(address, messageHelloWorld, signatureHelloWorldAlt);
        const resultHelloWorldValidIITestnet =  Verifier.verifySignature(addressTestnet, messageHelloWorld, signatureHelloWorldAlt);
        // Correct addresses but incorrect signature
        const resultHelloWorldInvalidSig = Verifier.verifySignature(address, messageEmpty, signatureHelloWorld); // Mixed up the signature and message - should be false
        const resultHelloWorldInvalidSigTestnet = Verifier.verifySignature(addressTestnet, messageEmpty, signatureHelloWorld); // Mixed up the signature and message - should be false
        const resultEmptyInvalidSig = Verifier.verifySignature(address, messageHelloWorld, signatureEmpty); // Mixed up the signature and message - should be false
        const resultEmptyInvalidSigTestnet = Verifier.verifySignature(addressTestnet, messageHelloWorld, signatureEmpty); // Mixed up the signature and message - should be false
        // Incorrect addresses
        const resultEmptyInvalidAddress = Verifier.verifySignature(addressWrong, messageEmpty, signatureEmpty); // Wrong address - should be false
        const resultEmptyInvalidAddressTestnet = Verifier.verifySignature(addressWrongTestnet, messageEmpty, signatureEmpty); // Wrong address - should be false
        const resultHelloWorldInvalidAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signatureHelloWorld); // Wrong address - should be false
        const resultHelloWorldInvalidAddressTestnet = Verifier.verifySignature(addressWrongTestnet, messageHelloWorld, signatureHelloWorld); // Wrong address - should be false
        
        // Assert
        expect(resultEmptyValid).to.be.true;
        expect(resultEmptyValidTestnet).to.be.true;
        expect(resultHelloWorldValid).to.be.true;
        expect(resultHelloWorldValidTestnet).to.be.true;
        expect(resultHelloWorldValidII).to.be.true;
        expect(resultHelloWorldValidIITestnet).to.be.true;
        expect(resultHelloWorldInvalidSig).to.be.false;
        expect(resultHelloWorldInvalidSigTestnet).to.be.false;
        expect(resultEmptyInvalidSig).to.be.false; 
        expect(resultEmptyInvalidSigTestnet).to.be.false; 
        expect(resultEmptyInvalidAddress).to.be.false;
        expect(resultEmptyInvalidAddressTestnet).to.be.false;
        expect(resultHelloWorldInvalidAddress).to.be.false;
        expect(resultHelloWorldInvalidAddressTestnet).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for single-key-spend P2TR address using SIGHASH_ALL flag', () => {
        // Arrange
        // Test vector listed at https://github.com/bitcoin/bitcoin/blob/29b28d07fa958b89e1c7916fda5d8654474cf495/src/test/util_tests.cpp#L2747
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const addressTestnet = 'tb1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5s3g3s37';
        const addressWrong = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
        const addressWrongTestnet = 'tb1p000273lqsqqfw2a6h2vqxr2tll4wgtv7zu8a30rz4mhree8q5jzq8cjtyp';
        const messageWrong = "";
        const messageHelloWorld = "Hello World";
        const signatureHelloWorld = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==";

        // Act
        const resultCorrect = Verifier.verifySignature(address, messageHelloWorld, signatureHelloWorld); // Everything correct
        const resultCorrectTestnet = Verifier.verifySignature(addressTestnet, messageHelloWorld, signatureHelloWorld); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signatureHelloWorld); // Wrong message - should be false
        const resultWrongMessageTestnet = Verifier.verifySignature(addressTestnet, messageWrong, signatureHelloWorld); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signatureHelloWorld); // Wrong address - should be false
        const resultWrongAddressTestnet = Verifier.verifySignature(addressWrongTestnet, messageHelloWorld, signatureHelloWorld); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultCorrectTestnet).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongMessageTestnet).to.be.false;
        expect(resultWrongAddress).to.be.false;
        expect(resultWrongAddressTestnet).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for single-key-spend P2TR address using SIGHASH_DEFAULT flag', () => {
        // Arrange
        const privateKey = 'L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k'; // Private key of bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const addressTestnet = 'tb1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5s3g3s37';
        const addressWrong = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
        const addressWrongTestnet = 'tb1p000273lqsqqfw2a6h2vqxr2tll4wgtv7zu8a30rz4mhree8q5jzq8cjtyp';
        const messageWrong = "";
        const messageHelloWorld = "Hello World";
        // Initialize private key used to sign the transaction
        const ECPair = ECPairFactory(ecc);
        const testPrivateKey = ECPair.fromWIF(privateKey);
        // Extract the taproot internal public key
        const internalPublicKey = testPrivateKey.publicKey.subarray(1, 33);
        // Tweak the private key for signing, since the output and address uses tweaked key
        // Reference: https://github.com/bitcoinjs/bitcoinjs-lib/blob/1a9119b53bcea4b83a6aa8b948f0e6370209b1b4/test/integration/taproot.spec.ts#L55
        const testPrivateKeyTweaked = testPrivateKey.tweak(
            bitcoin.crypto.taggedHash('TapTweak', testPrivateKey.publicKey.subarray(1, 33))
        );
        // Obtain the script public key
        const scriptPubKey = bitcoin.payments.p2tr({
			address: address
		}).output as Buffer;
        // Draft a toSpend transaction with messageHelloWorld
        const toSpendTx = BIP322.buildToSpendTx(messageHelloWorld, scriptPubKey);
        // Draft a toSign transaction that spends toSpend transaction
        const toSignTx = BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey);
        // Sign the toSign transaction
        const toSignTxSigned = toSignTx.signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_DEFAULT]).finalizeAllInputs();
        // Extract the signature
        const signature = BIP322.encodeWitness(toSignTxSigned);

        // Act
        const resultCorrect = Verifier.verifySignature(address, messageHelloWorld, signature); // Everything correct
        const resultCorrectTestnet = Verifier.verifySignature(addressTestnet, messageHelloWorld, signature); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signature); // Wrong message - should be false
        const resultWrongMessageTestnet = Verifier.verifySignature(addressTestnet, messageWrong, signature); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signature); // Wrong address - should be false
        const resultWrongAddressTestnet = Verifier.verifySignature(addressWrongTestnet, messageHelloWorld, signature); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultCorrectTestnet).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongMessageTestnet).to.be.false;
        expect(resultWrongAddress).to.be.false;
        expect(resultWrongAddressTestnet).to.be.false;
    });

    it('Refuse to verify P2WSH transaction', () => {
        // Arrange
        // Taken from transaction 4221ff28411a87e6d412458689c471b875dd43aca7d02c7fb7c7331855581434
        const address = 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3';
        const message = ''; // Does not actually matter, it should throw due to the P2WSH address anyway
        const signature = 'ApAzMDQ1MDIyMTAwYzkzMWY5YzAxZmU2ZjRlNGY2N2M1NTY0NDc2NDY1OTI4OWQ4ZDRjYzcyM2ZlODJkZDJiOTdmYmZkYTA2NGJlYzAyMjAwZGZkNTg2ZjU4YzllZGJhODc0ZTBjZWY2NmU5ZmU5MWU3YWE3YTZjZGRkNmExZjU3MmVmYjY2ZmU5Y2FlZjJlMDFGMjEwMjc5YmU2NjdlZjlkY2JiYWM1NWEwNjI5NWNlODcwYjA3MDI5YmZjZGIyZGNlMjhkOTU5ZjI4MTViMTZmODE3OThhYw==';
        
        // Act
        const result = Verifier.verifySignature.bind(Verifier, address, message, signature);

        // Assert
        expect(result).to.throw('Only P2WPKH, P2SH-P2WPKH, and single-key-spend P2TR BIP-322 verification is supported. Unsupported address is provided.');
    });

    it('Refuse to verify script-spend P2TR transaction', () => {
        // Arrange
        // Taken from transaction d1042c9db36af59586e5681feeace356e85599a8fc0000cc50e263186a9c2276 which is an ordinal inscription transaction
        const address = 'bc1p3r88nsysd8sv555nur4h85wdupa5z0xpcgcdjxy5up30re8gcneswrkwkv';
        const message = ''; // Does not actually matter, it should throw due to the script-path spend included in the witness stack
        const signature = 'A4AxODdkNTJkNGVkNDQ2OThlY2M5NjJlZDc0ZDdmODIyODIwNDc1YTc1NjdjMTViYmFkOGY5MWNlOTZkMGYxMzJkMmQxM2U0MzA3OWFlNzAwMTE5YzkxYTQ2MjA4Yzk5NWUzYTE4YjUzNjYzNjhkZDA0NDUwYzNmZjU2NTIyMWQyY+AyMDVkZTgxNTRlNzBkNmFmNTI5MDZhNGM0ZDc4OThiMDE4MGRlNWRiOGI3Y2Q0NGNiZDI3Y2RkZmY3NzUxY2ViYzdhYzAwNjMwMzZmNzI2NDAxMDExODc0NjU3ODc0MmY3MDZjNjE2OTZlM2I2MzY4NjE3MjczNjU3NDNkNzU3NDY2MmQzODAwMmE3YjIyNzAyMjNhMjI3MzZlNzMyMjJjMjI2ZjcwMjIzYTIyNzI2NTY3MjIyYzIyNmU2MTZkNjUyMjNhMjIzNjMzMzEzMjM4MmU3MzYxNzQ3MzIyN2Q2OEJjMDVkZTgxNTRlNzBkNmFmNTI5MDZhNGM0ZDc4OThiMDE4MGRlNWRiOGI3Y2Q0NGNiZDI3Y2RkZmY3NzUxY2ViYzc=';
        
        // Act
        const result = Verifier.verifySignature.bind(Verifier, address, message, signature);

        // Assert
        expect(result).to.throw('BIP-322 verification from script-spend P2TR is unsupported.');
    });

    it('Reject verification from malformed address', () => {
        // Arrange
        const malformP2PKH = '1F3sAm6ZtwLAUnj7d38pGFxtP3RVEvtsbV' + 'M';
        const malformP2WPKHInP2SH = '37qyp7jQAzqb2rCBpMvVtLDuuzKAUCVnJb' + 'M';
        const malformedP2WPKH = 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l' + 'm';
        const malformedP2TR = 'bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3' + 'm';
        const message = ''; // Does not actually matter, it should throw due to the malformed address
        const signatureP2PKH = "H9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk="; // Correctly encoded P2PKH signature
        const signatureP2WPKH = "AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI="; // Correctly encoded P2WPKH signature
        const signatureP2TR = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ=="; // Correctly encoded P2TR signature

        // Act
        const resultP2PKH = Verifier.verifySignature.bind(Verifier, malformP2PKH, message, signatureP2PKH);
        const resultP2WPKHInP2SH = Verifier.verifySignature.bind(Verifier, malformP2WPKHInP2SH, message, signatureP2WPKH);
        const resultP2WPKH = Verifier.verifySignature.bind(Verifier, malformedP2WPKH, message, signatureP2WPKH);
        const resultP2Tr = Verifier.verifySignature.bind(Verifier, malformedP2TR, message, signatureP2TR);

        // Assert
        expect(resultP2PKH).to.throw("Invalid Bitcoin address is provided.");
        expect(resultP2WPKHInP2SH).to.throw("Invalid Bitcoin address is provided.");
        expect(resultP2WPKH).to.throws("Invalid Bitcoin address is provided.");
        expect(resultP2Tr).to.throws("Invalid Bitcoin address is provided.");
    });

    it('Reject Schnorr signature with incorrect length', () => {
        // Arrange
        // Test vector listed at https://github.com/bitcoin/bitcoin/blob/29b28d07fa958b89e1c7916fda5d8654474cf495/src/test/util_tests.cpp#L2747
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const messageHelloWorld = "Hello World";
        const signatureHelloWorld = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==";
        // Deserialize the signature
        const signatureHelloWorldDeserialized = Witness.deserialize(signatureHelloWorld)[0];
        // Append an extra byte at the end of signatureHelloWorld
        const signatureHelloWorldExtraByte = Buffer.concat([signatureHelloWorldDeserialized, Buffer.from([0xFF])]);
        // Serialize the modified signature into base64
        const signatureHelloWorldExtraByteSerialized = Witness.serialize([signatureHelloWorldExtraByte]);

        // Act
        const result = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureHelloWorldExtraByteSerialized); // Schnorr signature with incorrect length

        // Assert
        expect(result).to.throw('Invalid Schnorr signature provided.');
    });

    it('Reject signature signed using invalid SIGHASH', () => {
        // Arrange
        const privateKey = 'L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k'; // Private key of bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const messageHelloWorld = "Hello World";
        // Initialize private key used to sign the transaction
        const ECPair = ECPairFactory(ecc);
        const testPrivateKey = ECPair.fromWIF(privateKey);
        // Extract the taproot internal public key
        const internalPublicKey = testPrivateKey.publicKey.subarray(1, 33);
        // Tweak the private key for signing, since the output and address uses tweaked key
        // Reference: https://github.com/bitcoinjs/bitcoinjs-lib/blob/1a9119b53bcea4b83a6aa8b948f0e6370209b1b4/test/integration/taproot.spec.ts#L55
        const testPrivateKeyTweaked = testPrivateKey.tweak(
            bitcoin.crypto.taggedHash('TapTweak', testPrivateKey.publicKey.subarray(1, 33))
        );
        // Obtain the script public key
        const scriptPubKey = bitcoin.payments.p2tr({
			address: address
		}).output as Buffer;
        // Draft a toSpend transaction with messageHelloWorld
        const toSpendTx = BIP322.buildToSpendTx(messageHelloWorld, scriptPubKey);
        // Draft, sign the toSign transaction, and extract the signature using different SIGHASH
        const signatureAnyOneCanPay = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_ANYONECANPAY })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_ANYONECANPAY]).finalizeAllInputs()
        );
        const signatureInputMask = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_INPUT_MASK })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_INPUT_MASK]).finalizeAllInputs()
        );
        const signatureNone = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_NONE })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_NONE]).finalizeAllInputs()
        );
        const signatureOutputMask = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_OUTPUT_MASK })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_OUTPUT_MASK]).finalizeAllInputs()
        );
        const signatureSingle = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_SINGLE })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_SINGLE]).finalizeAllInputs()
        );

        // Act
        const resultAnyOneCanPay = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureAnyOneCanPay);
        const resultInputMask = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureInputMask);
        const resultNone = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureNone);
        const resultOutputMask = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureOutputMask);
        const resultSingle = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureSingle);

        // Assert
        expect(resultAnyOneCanPay).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultInputMask).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultNone).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultOutputMask).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultSingle).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
    });

    it('Fix issue #7', () => {
        // Arrange
        const address = "3Agx7m86mJgVbLZP3Wk1qjYkzv6gGemz9X";
        const message = "48656c6c6f20426974636f696e2034352e3133302e3130352e313436";
        const signature = "JDkLNaM8vWoobA34PGQE9FIZaLF7peRh4r7DOqOHls1cP1DPwR3Hcy26+zk6yRb0qtJRHEdUflVxkScbwsOCSMw=";

        // Act and Assert
        expect(Verifier.verifySignature(address, message, signature)).to.be.true;
    });

});