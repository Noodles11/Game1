import './style.css';
import { App } from './ui/app';

const app = new App(document.getElementById('app')!);
// ?debug exposes the app for soak tests and tinkering in the console
if (location.search.includes('debug')) (window as unknown as { reprint: App }).reprint = app;
