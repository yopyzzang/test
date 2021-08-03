import {XmbMessageParser} from './xmb-message-parser';
import {ParsedMessage} from './parsed-message';
/**
 * Created by martin on 17.05.2017.
 * Testcases for parsing normalized messages to XMB format and vive versa.
 */

describe('message parse XMB test spec', () => {

    /**
     * Helperfunction to create a parsed message from normalized string.
     * @param normalizedString normalizedString
     * @param sourceMessage sourceMessage
     * @return ParsedMessage
     */
    function parsedMessageFor(normalizedString: string, sourceMessage?: ParsedMessage): ParsedMessage {
        const parser = new XmbMessageParser();
        return parser.parseNormalizedString(normalizedString, sourceMessage);
    }

    /**
     * Helperfunction to create a parsed message from native xml.
     * @param xmlContent xmlContent
     * @param sourceMessage sourceMessage
     * @return ParsedMessage
     */
    function parsedMessageFromXML(xmlContent: string, sourceMessage?: ParsedMessage): ParsedMessage {
        const parser = new XmbMessageParser();
        return parser.createNormalizedMessageFromXMLString(xmlContent, sourceMessage);
    }

    /**
     * create normalized message from string, then create one from generated xml.
     * Check that it is the same.
     * @param normalizedMessage normalizedMessage
     */
    function checkToXmlAndBack(normalizedMessage: string) {
        const xml = parsedMessageFor(normalizedMessage).asNativeString();
        expect(parsedMessageFromXML('<msg>' + xml + '</msg>').asDisplayString()).toBe(normalizedMessage);
    }

    describe('normalized message to xml', () => {

        it('should parse plain text', () => {
            const normalizedMessage = 'a text without anything special';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString()).toBe(normalizedMessage);
        });

        it('should parse text with placeholder', () => {
            const normalizedMessage = 'a placeholder: {{0}}';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString()).toBe('a placeholder: <ph name="INTERPOLATION"><ex>INTERPOLATION</ex></ph>');
            checkToXmlAndBack(normalizedMessage);
        });

        it('should parse text with 2 placeholders', () => {
            const normalizedMessage = '{{1}}: a placeholder: {{0}}';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString())
                .toBe('<ph name="INTERPOLATION_1"><ex>INTERPOLATION_1</ex></ph>' +
                    ': a placeholder: <ph name="INTERPOLATION"><ex>INTERPOLATION</ex></ph>');
            checkToXmlAndBack(normalizedMessage);
        });

        it('should parse simple bold tag', () => {
            const normalizedMessage = 'a text <b>with</b> a bold text';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString())
                .toBe('a text <ph name="START_BOLD_TEXT"><ex>&lt;b></ex></ph>' +
                    'with<ph name="CLOSE_BOLD_TEXT"><ex>&lt;/b></ex></ph> a bold text');
            checkToXmlAndBack(normalizedMessage);
        });

        it('should parse simple italic tag', () => {
            const normalizedMessage = 'a text <i>with</i> emphasis';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString())
                .toBe('a text <ph name="START_ITALIC_TEXT"><ex>&lt;i></ex></ph>' +
                    'with<ph name="CLOSE_ITALIC_TEXT"><ex>&lt;/i></ex></ph> emphasis');
            checkToXmlAndBack(normalizedMessage);
        });

        it('should parse unknown tag', () => {
            const normalizedMessage = 'a text with <strange>strange emphasis</strange>';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString())
                .toBe('a text with <ph name="START_TAG_STRANGE"><ex>&lt;strange></ex></ph>' +
                    'strange emphasis<ph name="CLOSE_TAG_STRANGE"><ex>&lt;/strange></ex></ph>');
            checkToXmlAndBack(normalizedMessage);
        });

        it('should parse embedded tags with placeholder inside', () => {
            const normalizedMessage = '<b><i><strange>Placeholder {{0}}</strange></i></b>';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString())
                .toBe('<ph name="START_BOLD_TEXT"><ex>&lt;b></ex></ph><ph name="START_ITALIC_TEXT"><ex>&lt;i></ex></ph>' +
                    '<ph name="START_TAG_STRANGE"><ex>&lt;strange></ex></ph>Placeholder <ph name="INTERPOLATION">' +
                    '<ex>INTERPOLATION</ex></ph><ph name="CLOSE_TAG_STRANGE"><ex>&lt;/strange></ex></ph><ph name="CLOSE_ITALIC_TEXT">' +
                    '<ex>&lt;/i></ex></ph><ph name="CLOSE_BOLD_TEXT"><ex>&lt;/b></ex></ph>');
            checkToXmlAndBack(normalizedMessage);
        });

        it('should parse ICU Refs', () => {
            const normalizedMessage = 'a text with <ICU-Message-Ref_0/>';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString()).toBe('a text with <ph name="ICU"><ex>ICU</ex></ph>');
            checkToXmlAndBack(normalizedMessage);
        });

    });

    describe('xml to normalized message', () => {

        it('should parse simple text content', () => {
           const parsedMessage = parsedMessageFromXML('a simple content');
           expect(parsedMessage.asDisplayString()).toBe('a simple content');
        });

        it('should parse strange tag with placeholder content', () => {
            const parsedMessage = parsedMessageFromXML('Diese Nachricht ist <ph name="START_TAG_STRANGE">' +
                '<ex>&lt;strange></ex></ph><ph name="INTERPOLATION"><ex>INTERPOLATION</ex></ph><ph name="CLOSE_TAG_STRANGE">' +
                '<ex>&lt;/strange></ex></ph>');
            expect(parsedMessage.asDisplayString()).toBe('Diese Nachricht ist <strange>{{0}}</strange>');
        });

        it('should parse embedded tags', () => {
            const parsedMessage = parsedMessageFromXML('Diese Nachricht ist <ph name="START_BOLD_TEXT">' +
                '<ex>&lt;b></ex></ph><ph name="START_TAG_STRANGE"><ex>&lt;strange></ex></ph>SEHR WICHTIG<ph name="CLOSE_TAG_STRANGE">' +
                '<ex>&lt;/strange></ex></ph><ph name="CLOSE_BOLD_TEXT"><ex>&lt;/b></ex></ph>');
            expect(parsedMessage.asDisplayString()).toBe('Diese Nachricht ist <b><strange>SEHR WICHTIG</strange></b>');
        });

        it('should parse complex message with embedded placeholder', () => {
            const parsedMessage = parsedMessageFromXML('<ph name="START_LINK"><ex>&lt;a>' +
                '</ex></ph>link1 with placeholder <ph name="INTERPOLATION"><ex>INTERPOLATION</ex>' +
                '</ph><ph name="CLOSE_LINK"><ex>&lt;/a></ex></ph>');
            expect(parsedMessage.asDisplayString()).toBe('<a>link1 with placeholder {{0}}</a>');
        });

        it('should throw an error due to not well formed elements <b><strange></b>', () => {
            try {
                const parsedMessage = parsedMessageFromXML('Diese Nachricht ist falsch geschachtelt: <ph name="START_BOLD_TEXT">' +
                    '<ex>&lt;b></ex></ph><ph name="START_TAG_STRANGE"><ex>&lt;strange></ex></ph>' +
                    'FALSCH<x id="CLOSE_BOLD_TEXT" ctype="x-b"/></ph><ph name="CLOSE_BOLD_TEXT"><ex>&lt;/b></ex></ph>');
                expect('parsedMessage').toBe('should throw an error');
            } catch (e) {
                expect(e.message).toContain('unexpected close tag b');
            }
        });

        it('should parse message with embedded ICU message reference', () => {
            const parsedMessage = parsedMessageFromXML('first: <ph name="ICU"><ex>ICU</ex></ph>');
            expect(parsedMessage.asDisplayString()).toBe('first: <ICU-Message-Ref_0/>');
        });

        it('should parse message with 2 embedded ICU message reference', () => {
            const parsedMessage = parsedMessageFromXML('first: <ph name="ICU"><ex>ICU</ex></ph>' +
                ', second <ph name="ICU_1"><ex>ICU</ex></ph>');
            expect(parsedMessage.asDisplayString()).toBe('first: <ICU-Message-Ref_0/>, second <ICU-Message-Ref_1/>');
        });

        it('should parse empty tag like <br>', () => {
            const normalizedMessage = 'one line<br>second line';
            const parsedMessage = parsedMessageFor(normalizedMessage);
            expect(parsedMessage.asDisplayString()).toBe(normalizedMessage);
            expect(parsedMessage.asNativeString()).toBe('one line<ph name="LINE_BREAK"><ex>&lt;br></ex></ph>second line');
            checkToXmlAndBack(normalizedMessage);
        });

    });

});
