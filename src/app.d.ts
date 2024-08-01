import '@fontsource/newsreader/200-italic.css';
import '@fontsource/newsreader/300-italic.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/newsreader/600-italic.css';
import '@fontsource/newsreader/700-italic.css';
import '@fontsource/newsreader/800-italic.css';
import '@fontsource/newsreader/200.css';
import '@fontsource/newsreader/300.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/700.css';
import '@fontsource/newsreader/800.css';
import '@fontsource/inter';

import PocketBase from 'pocketbase';
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            pb: PocketBase;
            id: string;
            email: string;
        }
        // interface PageData {}
        // interface Platform {}
    }
}

export {};