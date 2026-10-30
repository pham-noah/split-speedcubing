import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { platform } from '$platform';

mount(App, { target: document.getElementById('app')! });
platform.shell();
