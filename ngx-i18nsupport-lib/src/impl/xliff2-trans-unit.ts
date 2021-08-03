import {STATE_NEW, STATE_TRANSLATED, STATE_FINAL} from '../api/constants';
import {ITranslationMessagesFile} from '../api/i-translation-messages-file';
import {INormalizedMessage} from '../api/i-normalized-message';
import {ITransUnit} from '../api/i-trans-unit';
import {INote} from '../api/i-note';
import {DOMUtilities} from './dom-utilities';
import {ParsedMessage} from './parsed-message';
import {AbstractTransUnit} from './abstract-trans-unit';
import {Xliff2MessageParser} from './xliff2-message-parser';
import {AbstractMessageParser} from './abstract-message-parser';
import {isNullOrUndefined} from 'util';
/**
 * Created by martin on 04.05.2017.
 * A Translation Unit in an XLIFF 2.0 file.
 */

export class Xliff2TransUnit extends AbstractTransUnit  implements ITransUnit {

    constructor(_element: Element, _id: string, _translationMessagesFile: ITranslationMessagesFile) {
        super(_element, _id, _translationMessagesFile);
    }

    public sourceContent(): string {
        const sourceElement = DOMUtilities.getFirstElementByTagName(this._element, 'source');
        return DOMUtilities.getXMLContent(sourceElement);
    }

    /**
     * Set new source content in the transunit.
     * Normally, this is done by ng-extract.
     * Method only exists to allow xliffmerge to merge missing changed source content.
     * @param newContent the new content.
     */
    public setSourceContent(newContent: string) {
        let source = DOMUtilities.getFirstElementByTagName(this._element, 'source');
        if (!source) {
            // should not happen, there always has to be a source, but who knows..
            const segment = DOMUtilities.getFirstElementByTagName(this._element, 'segment');
            source = segment.parentNode.appendChild(this._element.ownerDocument.createElement('source'));
        }
        DOMUtilities.replaceContentWithXMLContent(source, newContent);
    }

    /**
     * Return a parser used for normalized messages.
     */
    protected messageParser(): AbstractMessageParser {
        return new Xliff2MessageParser();
    }

    /**
     * The original text value, that is to be translated, as normalized message.
     */
    public createSourceContentNormalized(): ParsedMessage {
        const sourceElement = DOMUtilities.getFirstElementByTagName(this._element, 'source');
        if (sourceElement) {
            return this.messageParser().createNormalizedMessageFromXML(sourceElement, null);
        } else {
            return null;
        }
    }

    /**
     * the translated value (containing all markup, depends on the concrete format used).
     */
    public targetContent(): string {
        const targetElement = DOMUtilities.getFirstElementByTagName(this._element, 'target');
        return DOMUtilities.getXMLContent(targetElement);
    }

    /**
     * the translated value, but all placeholders are replaced with {{n}} (starting at 0)
     * and all embedded html is replaced by direct html markup.
     */
    targetContentNormalized(): INormalizedMessage {
        const targetElement = DOMUtilities.getFirstElementByTagName(this._element, 'target');
        return new Xliff2MessageParser().createNormalizedMessageFromXML(targetElement, this.sourceContentNormalized());
    }

    /**
     * State of the translation as stored in the xml.
     */
    public nativeTargetState(): string {
        const segmentElement = DOMUtilities.getFirstElementByTagName(this._element, 'segment');
        if (segmentElement) {
            return segmentElement.getAttribute('state');
        } else {
            return null;
        }
    }

    /**
     * set state in xml.
     * @param nativeState nativeState
     */
    protected setNativeTargetState(nativeState: string) {
        const segmentElement = DOMUtilities.getFirstElementByTagName(this._element, 'segment');
        if (segmentElement) {
            segmentElement.setAttribute('state', nativeState);
        }
    }

    /**
     * Map an abstract state (new, translated, final) to a concrete state used in the xml.
     * Returns the state to be used in the xml.
     * @param state one of Constants.STATE...
     * @returns a native state (depends on concrete format)
     * @throws error, if state is invalid.
     */
    protected mapStateToNativeState(state: string): string {
        switch ( state) {
            case STATE_NEW:
                return 'initial';
            case STATE_TRANSLATED:
                return 'translated';
            case STATE_FINAL:
                return 'final';
            default:
                throw new Error('unknown state ' +  state);
        }
    }

    /**
     * Map a native state (found in the document) to an abstract state (new, translated, final).
     * Returns the abstract state.
     * @param nativeState nativeState
     */
    protected mapNativeStateToState(nativeState: string): string {
        switch ( nativeState) {
            case 'initial':
                return STATE_NEW;
            case 'translated':
                return STATE_TRANSLATED;
            case 'reviewed': // same as translated
                return STATE_TRANSLATED;
            case 'final':
                return STATE_FINAL;
            default:
                return STATE_NEW;
        }
    }

    /**
     * All the source elements in the trans unit.
     * The source element is a reference to the original template.
     * It contains the name of the template file and a line number with the position inside the template.
     * It is just a help for translators to find the context for the translation.
     * This is set when using Angular 4.0 or greater.
     * Otherwise it just returns an empty array.
     */
    public sourceReferences(): {sourcefile: string, linenumber: number}[] {
        // Source is found as <file>:<line> in <note category="location">...
        const noteElements = this._element.getElementsByTagName('note');
        const sourceRefs: { sourcefile: string, linenumber: number }[] = [];
        for (let i = 0; i < noteElements.length; i++) {
            const noteElem = noteElements.item(i);
            if (noteElem.getAttribute('category') === 'location') {
                const sourceAndPos: string = DOMUtilities.getPCDATA(noteElem);
                sourceRefs.push(this.parseSourceAndPos(sourceAndPos));
            }
        }
        return sourceRefs;
    }

    /**
     * Parses something like 'c:\xxx:7' and returns source and linenumber.
     * @param sourceAndPos something like 'c:\xxx:7', last colon is the separator
     * @return source and line number
     */
    private parseSourceAndPos(sourceAndPos: string): { sourcefile: string, linenumber } {
        const index = sourceAndPos.lastIndexOf(':');
        if (index < 0) {
            return {
                sourcefile: sourceAndPos,
                linenumber: 0
            };
        } else {
            return {
                sourcefile: sourceAndPos.substring(0, index),
                linenumber: this.parseLineNumber(sourceAndPos.substring(index + 1))
            };
        }
    }

    private parseLineNumber(lineNumberString: string): number {
        return Number.parseInt(lineNumberString, 10);
    }

    /**
     * Set source ref elements in the transunit.
     * Normally, this is done by ng-extract.
     * Method only exists to allow xliffmerge to merge missing source refs.
     * @param sourceRefs the sourcerefs to set. Old ones are removed.
     */
    public setSourceReferences(sourceRefs: {sourcefile: string, linenumber: number}[]) {
        this.removeAllSourceReferences();
        let notesElement = DOMUtilities.getFirstElementByTagName(this._element, 'notes');
        if (sourceRefs.length === 0 && !isNullOrUndefined(notesElement) && notesElement.childNodes.length === 0) {
            // remove empty notes element
            notesElement.parentNode.removeChild(notesElement);
            return;
        }
        if (isNullOrUndefined(notesElement)) {
            notesElement = this._element.ownerDocument.createElement('notes');
            this._element.insertBefore(notesElement, this._element.childNodes.item(0));
        }
        sourceRefs.forEach((ref) => {
            const note = this._element.ownerDocument.createElement('note');
            note.setAttribute('category', 'location');
            note.appendChild(this._element.ownerDocument.createTextNode(ref.sourcefile + ':' + ref.linenumber.toString(10)));
            notesElement.appendChild(note);
        });
    }

    private removeAllSourceReferences() {
        const noteElements = this._element.getElementsByTagName('note');
        const toBeRemoved = [];
        for (let i = 0; i < noteElements.length; i++) {
            const elem = noteElements.item(i);
            if (elem.getAttribute('category') === 'location') {
                toBeRemoved.push(elem);
            }
        }
        toBeRemoved.forEach((elem) => {elem.parentNode.removeChild(elem); });
    }

    /**
     * The description set in the template as value of the i18n-attribute.
     * e.g. i18n="mydescription".
     * In xliff 2.0 this is stored as a note element with attribute category="description".
     */
    public description(): string {
        const noteElem = this.findNoteElementWithCategoryAttribute('description');
        if (noteElem) {
            return DOMUtilities.getPCDATA(noteElem);
        } else {
            return null;
        }
    }

    /**
     * Change description property of trans-unit.
     * @param description description
     */
    public setDescription(description: string) {
        const noteElem = this.findNoteElementWithCategoryAttribute('description');
        if (description) {
            if (isNullOrUndefined(noteElem)) {
                // create it
                this.createNoteElementWithCategoryAttribute('description', description);
            } else {
                DOMUtilities.replaceContentWithXMLContent(noteElem, description);
            }
        } else {
            if (!isNullOrUndefined(noteElem)) {
                // remove node
                this.removeNoteElementWithCategoryAttribute('description');
            }
        }
    }

    /**
     * Find a note element with attribute category='<attrValue>'
     * @param attrValue value of category attribute
     * @return element or null is absent
     */
    private findNoteElementWithCategoryAttribute(attrValue: string): Element {
        const noteElements = this._element.getElementsByTagName('note');
        for (let i = 0; i < noteElements.length; i++) {
            const noteElem = noteElements.item(i);
            if (noteElem.getAttribute('category') === attrValue) {
                return noteElem;
            }
        }
        return null;
    }

    /**
     * Get all note elements where from attribute is not description or meaning
     * @return elements
     */
    private findAllAdditionalNoteElements(): Element[] {
        const noteElements = this._element.getElementsByTagName('note');
        const result: Element[] = [];
        for (let i = 0; i < noteElements.length; i++) {
            const noteElem = noteElements.item(i);
            const fromAttribute = noteElem.getAttribute('category');
            if (fromAttribute !== 'description' && fromAttribute !== 'meaning') {
                result.push(noteElem);
            }
        }
        return result;
    }

    /**
     * Create a new note element with attribute from='<attrValue>'
     * @param attrValue category attribute value
     * @param content content of note element
     * @return the new created element
     */
    private createNoteElementWithCategoryAttribute(attrValue: string, content: string): Element {
        let notesElement = DOMUtilities.getFirstElementByTagName(this._element, 'notes');
        if (isNullOrUndefined(notesElement)) {
            // create it
            notesElement = this._element.ownerDocument.createElement('notes');
            this._element.appendChild(notesElement);
        }
        const noteElement = this._element.ownerDocument.createElement('note');
        if (attrValue) {
            noteElement.setAttribute('category', attrValue);
        }
        if (content) {
            DOMUtilities.replaceContentWithXMLContent(noteElement, content);
        }
        notesElement.appendChild(noteElement);
        return noteElement;
    }

    private removeNotesElementIfEmpty() {
        const notesElement = DOMUtilities.getFirstElementByTagName(this._element, 'notes');
        if (notesElement) {
            const childNote = DOMUtilities.getFirstElementByTagName(this._element, 'note');
            if (!childNote) {
                // remove notes element
                notesElement.parentNode.removeChild(notesElement);
            }
        }
    }

    /**
     * Remove note element with attribute from='<attrValue>'
     * @param attrValue attrValue
     */
    private removeNoteElementWithCategoryAttribute(attrValue: string) {
        const noteElement = this.findNoteElementWithCategoryAttribute(attrValue);
        if (noteElement) {
            noteElement.parentNode.removeChild(noteElement);
        }
        this.removeNotesElementIfEmpty();
    }

    /**
     * Remove all note elements where attribute "from" is not description or meaning.
     */
    private removeAllAdditionalNoteElements() {
        const noteElements = this.findAllAdditionalNoteElements();
        noteElements.forEach((noteElement) => {
            noteElement.parentNode.removeChild(noteElement);
        });
        this.removeNotesElementIfEmpty();
    }

    /**
     * The meaning (intent) set in the template as value of the i18n-attribute.
     * This is the part in front of the | symbol.
     * e.g. i18n="meaning|mydescription".
     * In xliff 2.0 this is stored as a note element with attribute category="meaning".
     */
    public meaning(): string {
        const noteElem = this.findNoteElementWithCategoryAttribute('meaning');
        if (noteElem) {
            return DOMUtilities.getPCDATA(noteElem);
        } else {
            return null;
        }
    }

    /**
     * Change meaning property of trans-unit.
     * @param meaning meaning
     */
    public setMeaning(meaning: string) {
        const noteElem = this.findNoteElementWithCategoryAttribute('meaning');
        if (meaning) {
            if (isNullOrUndefined(noteElem)) {
                // create it
                this.createNoteElementWithCategoryAttribute('meaning', meaning);
            } else {
                DOMUtilities.replaceContentWithXMLContent(noteElem, meaning);
            }
        } else {
            if (!isNullOrUndefined(noteElem)) {
                // remove node
                this.removeNoteElementWithCategoryAttribute('meaning');
            }
        }
    }

    /**
     * Get all notes of the trans-unit.
     * Notes are remarks made by a translator.
     * (description and meaning are not included here!)
     */
    public notes(): INote[] {
        const noteElememts: Element[] = this.findAllAdditionalNoteElements();
        return noteElememts.map(elem => {
            return {
                from: elem.getAttribute('category'),
                text: DOMUtilities.getPCDATA(elem)
            };
        });
    }

    /**
     * Test, wether setting of notes is supported.
     * If not, setNotes will do nothing.
     * xtb does not support this, all other formats do.
     */
    public supportsSetNotes(): boolean {
        return true;
    }

    /**
     * Add notes to trans unit.
     * @param newNotes the notes to add.
     */
    public setNotes(newNotes: INote[]) {
        if (!isNullOrUndefined(newNotes)) {
            this.checkNotes(newNotes);
        }
        this.removeAllAdditionalNoteElements();
        if (!isNullOrUndefined(newNotes)) {
            newNotes.forEach((note) => {
                this.createNoteElementWithCategoryAttribute(note.from, note.text);
            });
        }
    }

    /**
     * Set the translation to a given string (including markup).
     * @param translation translation
     */
    protected translateNative(translation: string) {
        let target = DOMUtilities.getFirstElementByTagName(this._element, 'target');
        if (!target) {
            const source = DOMUtilities.getFirstElementByTagName(this._element, 'source');
            target = source.parentNode.appendChild(this._element.ownerDocument.createElement('target'));
        }
        DOMUtilities.replaceContentWithXMLContent(target, <string> translation);
        this.setTargetState(STATE_TRANSLATED);
    }

    /**
     * Copy source to target to use it as dummy translation.
     * Returns a changed copy of this trans unit.
     * receiver is not changed.
     * (internal usage only, a client should call importNewTransUnit on ITranslationMessageFile)
     */
    public cloneWithSourceAsTarget(isDefaultLang: boolean, copyContent: boolean, targetFile: ITranslationMessagesFile): AbstractTransUnit {
        const element = <Element> this._element.cloneNode(true);
        const clone = new Xliff2TransUnit(element, this._id, targetFile);
        clone.useSourceAsTarget(isDefaultLang, copyContent);
        return clone;
    }

    /**
     * Copy source to target to use it as dummy translation.
     * (internal usage only, a client should call createTranslationFileForLang on ITranslationMessageFile)
     */
    public useSourceAsTarget(isDefaultLang: boolean, copyContent: boolean) {
        const source = DOMUtilities.getFirstElementByTagName(this._element, 'source');
        let target = DOMUtilities.getFirstElementByTagName(this._element, 'target');
        if (!target) {
            target = source.parentNode.appendChild(this._element.ownerDocument.createElement('target'));
        }
        if (isDefaultLang || copyContent) {
            const sourceString = DOMUtilities.getXMLContent(source);
            let newTargetString = sourceString;
            if (!this.isICUMessage(sourceString)) {
                newTargetString = this.translationMessagesFile().getNewTransUnitTargetPraefix()
                    + sourceString
                    + this.translationMessagesFile().getNewTransUnitTargetSuffix();
            }
            DOMUtilities.replaceContentWithXMLContent(target, newTargetString);
        } else {
            DOMUtilities.replaceContentWithXMLContent(target, '');
        }
        const segment = DOMUtilities.getFirstElementByTagName(this._element, 'segment');
        if (segment) {
            if (isDefaultLang) {
                segment.setAttribute('state', this.mapStateToNativeState(STATE_FINAL));
            } else {
                segment.setAttribute('state', this.mapStateToNativeState(STATE_NEW));
            }
        }
    }

}
