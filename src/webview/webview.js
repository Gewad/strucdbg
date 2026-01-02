(function() {
    // Initialize immediately
    
    const vscode = acquireVsCodeApi();
    const tabsContainer = document.getElementById('tabs-container');
    const sessionsContainer = document.getElementById('sessions-container');
    const input = document.getElementById('repl-input');
    
    let messageCount = 0;
    let sessionCounter = 0;
    let activeSession = null;
    const sessions = new Map(); // sessionId -> { tab, content, logsDiv, operationGroups }
    const pendingCodeRequests = new Map(); // requestId -> codeDiv element
    let autoScroll = true; // Auto-scroll enabled by default

    // Detect user scrolling up to disable auto-scroll
    let lastScrollTop = 0;
    let autoscrollCutoff = 8;
    // Listen on the sessions container (it is now the scrollable area)
    sessionsContainer.addEventListener('scroll', () => {
        const scrollTop = sessionsContainer.scrollTop;
        const scrollHeight = sessionsContainer.scrollHeight;
        const clientHeight = sessionsContainer.clientHeight;
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);

        // If user scrolled up (not at bottom), disable auto-scroll
        if (scrollTop < lastScrollTop && distanceFromBottom > autoscrollCutoff) {
            autoScroll = false;
        }
        // If user scrolled to near bottom (within autoscrollCutoff px), re-enable auto-scroll
        else if (distanceFromBottom < autoscrollCutoff) {
            autoScroll = true;
        }

        lastScrollTop = scrollTop;
    });

    // Create initial session
    createSession('Welcome', 'Welcome', true);
    const welcomeSession = sessions.get('Welcome');
    const testDiv = document.createElement('div');
    testDiv.className = 'log-entry raw';
    testDiv.textContent = 'Webview script loaded successfully. Start debugging to create a new session.';
    welcomeSession.logsDiv.appendChild(testDiv);

    function createSession(sessionName, sessionId = null, isWelcome = false) {
        // Use provided sessionId or generate one
        if (!sessionId) {
            sessionId = isWelcome ? sessionName : `session-${++sessionCounter}`;
        }
        
        if (sessions.has(sessionId)) {
            switchToSession(sessionId);
            return sessionId;
        }
        
        // Create tab
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.innerHTML = `<span>${escapeHtml(sessionName)}</span>`;
        
        if (!isWelcome) {
            // Create close button (hidden while session is active)
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close';
            closeBtn.textContent = '×';
            closeBtn.style.display = 'none';
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                const session = sessions.get(sessionId);
                if (session && !session.isActive) {
                    closeSession(sessionId);
                }
            };

            // Create spinner to indicate running session
            const spinner = document.createElement('span');
            spinner.className = 'tab-spinner';
            spinner.title = 'Session running';
            spinner.style.display = 'inline-block';

            tab.appendChild(spinner);
            tab.appendChild(closeBtn);
        }
        
        tab.onclick = () => switchToSession(sessionId);
        tabsContainer.appendChild(tab);
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'session-content';
        content.dataset.sessionId = sessionId;
        
        const logsDiv = document.createElement('div');
        logsDiv.className = 'logs';
        content.appendChild(logsDiv);
        
        sessionsContainer.appendChild(content);
        
        sessions.set(sessionId, {
            tab,
            content,
            logsDiv,
            operationGroups: new Map(),
            name: sessionName,
            isActive: true,
            // store refs to spinner and close button for toggling
            closeBtn: !isWelcome ? tab.querySelector('.tab-close') : null,
            spinner: !isWelcome ? tab.querySelector('.tab-spinner') : null
        });
        
        switchToSession(sessionId);
        return sessionId;
    }

    function switchToSession(sessionId) {
        if (!sessions.has(sessionId)) return;
        
        // Deactivate all
        sessions.forEach(session => {
            session.tab.classList.remove('active');
            session.content.classList.remove('active');
        });
        
        // Activate selected
        const session = sessions.get(sessionId);
        session.tab.classList.add('active');
        session.content.classList.add('active');
        activeSession = sessionId;
    }

    function closeSession(sessionId) {
        if (!sessions.has(sessionId) || sessionId === 'Welcome') return;
        
        const session = sessions.get(sessionId);
        session.tab.remove();
        session.content.remove();
        sessions.delete(sessionId);
        
        // Switch to another session if this was active
        if (activeSession === sessionId) {
            const remainingSessions = Array.from(sessions.keys());
            if (remainingSessions.length > 0) {
                switchToSession(remainingSessions[remainingSessions.length - 1]);
            }
        }
    }

    // Handle incoming logs from Extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.type === 'new-session') {
            // Create new session for debug session
            createSession(
                message.sessionName || `Session ${sessionCounter + 1}`,
                message.sessionId
            );
        } else if (message.type === 'session-ended') {
            // Mark session as inactive: hide spinner, show close button
            const session = sessions.get(message.sessionId);
            if (session) {
                session.isActive = false;
                if (session.spinner) {
                    session.spinner.style.display = 'none';
                }
                if (session.closeBtn) {
                    session.closeBtn.style.display = 'inline-block';
                    session.closeBtn.style.opacity = '0.9';
                    session.closeBtn.style.cursor = 'pointer';
                }
            }
        } else if (message.type === 'code-line') {
            // Handle code line response
            const codeDiv = pendingCodeRequests.get(message.requestId);
            if (codeDiv) {
                if (message.code) {
                    codeDiv.textContent = message.code;
                } else {
                    codeDiv.textContent = '(unable to load code)';
                    codeDiv.style.opacity = '0.5';
                }
                pendingCodeRequests.delete(message.requestId);
            }
        } else if (message.type === 'new-log') {
            messageCount++;
            
            // Route logs to the appropriate session
            let sessionId = message.sessionId;
            
            // If sessionId is not set or the session doesn't exist, route to Welcome
            if (!sessionId || !sessions.has(sessionId)) {
                sessionId = 'Welcome';
            }
            
            const session = sessions.get(sessionId);
            
            if (message.logType === 'structured' && message.content.operation_id) {
                // Handle grouped operations
                handleOperationLog(session, message.content);
            } else {
                // Handle standalone logs
                const div = document.createElement('div');
                div.className = 'log-entry ' + message.logType;

                if (message.logType === 'structured') {
                    renderStructured(div, message.content);
                } else {
                    const prefix = message.logType === 'error' ? 'ERR: ' : 'RAW: ';
                    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
                    div.textContent = prefix + content;
                }
                
                session.logsDiv.appendChild(div);
                if (autoScroll) {
                    // Scroll the scrollable sessions container to bottom
                    sessionsContainer.scrollTop = sessionsContainer.scrollHeight;
                }
            }
        }
    });

    function handleOperationLog(session, data) {
        const opId = data.operation_id;
        const operationGroups = session.operationGroups;
        
        if (!operationGroups.has(opId)) {
            // First log for this operation - create the group container
            const groupDiv = document.createElement('div');
            groupDiv.className = 'log-entry structured';
            
            const subLogsContainer = document.createElement('div');
            subLogsContainer.className = 'details';
            subLogsContainer.style.display = 'none';
            
            // store the group's current highest-severity (start with this log's severity)
            const initialSeverity = getResolvedSeverityFromData(data);
            const formattedTs = formatTimestamp(data) || '';
            const groupObj = {
                container: groupDiv,
                subLogs: subLogsContainer,
                count: 0,
                severity: initialSeverity,
                opId: opId,
                firstMessage: data.message || '',
                lastMessage: data.message || '',
                firstTs: formattedTs,
                lastTs: formattedTs,
                header: null
            };
            operationGroups.set(opId, groupObj);
            
            renderOperationHeader(groupObj, data, subLogsContainer);
            groupDiv.appendChild(subLogsContainer);
            session.logsDiv.appendChild(groupDiv);
        } else {
            // Add to existing operation group
            const group = operationGroups.get(opId);

            // Add to existing operation group
            // Update group's last message/timestamp and severity as needed
            const incomingSeverity = getResolvedSeverityFromData(data);
            const formattedTs = formatTimestamp(data) || '';
            if (severityRank(incomingSeverity) > severityRank(group.severity)) {
                group.severity = incomingSeverity;
            }
            group.lastMessage = data.message || group.lastMessage;
            if (formattedTs) group.lastTs = formattedTs;

            group.count++;

            // Update header to reflect new messages/timestamps and severity
            updateOperationHeader(group);
            
            // Ensure count badge text is correct (updateOperationHeader preserves badge)
            const header = group.header || group.container.querySelector('.header');
            const countBadge = header.querySelector('.op-count') || createCountBadge();
            if (!header.querySelector('.op-count')) {
                header.appendChild(countBadge);
            }
            countBadge.textContent = `(${group.count + 1} logs)`;
        }
        
        // Add the log as a sub-entry
        const group = operationGroups.get(opId);
        const subLogDiv = document.createElement('div');
        subLogDiv.className = 'log-entry structured';
        subLogDiv.style.marginLeft = '0';
        subLogDiv.style.borderLeft = '3px solid var(--vscode-panel-border)';
        subLogDiv.style.paddingLeft = '8px';
        renderStructured(subLogDiv, data);
        group.subLogs.appendChild(subLogDiv);
        
        if (autoScroll) {
            // Scroll the scrollable sessions container to bottom
            sessionsContainer.scrollTop = sessionsContainer.scrollHeight;
        }
    }

    function createCountBadge() {
        const badge = document.createElement('span');
        badge.className = 'op-count';
        badge.style.marginLeft = '10px';
        badge.style.opacity = '0.7';
        badge.style.fontSize = '0.9em';
        return badge;
    }

    // Resolve severity from incoming structured log data and normalize common variants
    function getResolvedSeverityFromData(data) {
        try {
            const raw = (data && (data.severity || data.level || 'info')) || 'info';
            const s = String(raw).toLowerCase();
            return s === 'warn' ? 'warning' : s;
        } catch (e) {
            return 'info';
        }
    }

    // Numerical rank for severity comparison (higher = more severe)
    function severityRank(sev) {
        switch ((sev || '').toLowerCase()) {
            case 'debug': return 0;
            case 'info': return 1;
            case 'warning': return 2;
            case 'error': return 3;
            case 'critical': return 4;
            default: return 1;
        }
    }

    function renderOperationHeader(group, data, subLogsContainer) {
        const container = group.container;
        const header = document.createElement('div');
        header.className = 'header';
        const resolvedSeverity = group.severity || getResolvedSeverityFromData(data);

        // Use inline SVGs injected by the provider; fall back to a colored placeholder.
        const svgMap = window.__ICON_SVGS__ || {};
        const iconSvg = svgMap[resolvedSeverity] || svgMap[resolvedSeverity === 'warning' ? 'warn' : resolvedSeverity];
        const iconHtml = iconSvg ? iconSvg : `<span class="icon-placeholder"></span>`;

        // Build first -> last message and timestamps
        const firstMsg = group.firstMessage || '';
        const lastMsg = group.lastMessage || firstMsg;
        const msgHtml = (firstMsg && lastMsg && firstMsg !== lastMsg) ? `${escapeHtml(firstMsg)} -> ${escapeHtml(lastMsg)}` : escapeHtml(firstMsg || lastMsg);

        const firstTs = group.firstTs || '';
        const lastTs = group.lastTs || firstTs;
        const tsHtml = (firstTs && lastTs && firstTs !== lastTs) ? `${escapeHtml(firstTs)} -> ${escapeHtml(lastTs)}` : (firstTs || lastTs ? escapeHtml(firstTs || lastTs) : '');

        const opSpan = `<span style="opacity: 0.6; margin-left: 10px; font-size: 0.85em;">[${escapeHtml(data.operation_id)}]</span>`;
        const tsSpan = tsHtml ? `<span class="timestamp">${tsHtml}</span>` : '';

        header.innerHTML = `<span class="badge severity-${resolvedSeverity}">${iconHtml}</span> <span>${msgHtml}</span> ${opSpan} ${tsSpan}`;

        header.addEventListener('click', () => {
            const isOpen = subLogsContainer.style.display !== 'none';
            subLogsContainer.style.display = isOpen ? 'none' : 'block';
        });

        container.appendChild(header);
        group.header = header;
    }

    // Update an existing operation header in-place preserving count badge
    function updateOperationHeader(group) {
        const header = group.header || group.container.querySelector('.header');
        if (!header) return;
        const resolvedSeverity = group.severity || 'info';
        const svgMap = window.__ICON_SVGS__ || {};
        const iconSvg = svgMap[resolvedSeverity] || svgMap[resolvedSeverity === 'warning' ? 'warn' : resolvedSeverity];
        const iconHtml = iconSvg ? iconSvg : `<span class="icon-placeholder"></span>`;

        const firstMsg = group.firstMessage || '';
        const lastMsg = group.lastMessage || firstMsg;
        const msgHtml = (firstMsg && lastMsg && firstMsg !== lastMsg) ? `${escapeHtml(firstMsg)} -> ${escapeHtml(lastMsg)}` : escapeHtml(firstMsg || lastMsg);

        const firstTs = group.firstTs || '';
        const lastTs = group.lastTs || firstTs;
        const tsHtml = (firstTs && lastTs && firstTs !== lastTs) ? `${escapeHtml(firstTs)} -> ${escapeHtml(lastTs)}` : (firstTs || lastTs ? escapeHtml(firstTs || lastTs) : '');

        // Preserve existing op-count element if present
        const countBadge = header.querySelector('.op-count');

        // Rebuild header content
        const opSpan = `<span style="opacity: 0.6; margin-left: 10px; font-size: 0.85em;">[${escapeHtml(group.opId || '')}]</span>`;
        const tsSpan = tsHtml ? `<span class="timestamp">${tsHtml}</span>` : '';
        header.innerHTML = `<span class="badge severity-${resolvedSeverity}">${iconHtml}</span> <span>${msgHtml}</span> ${opSpan} ${tsSpan}`;

        if (countBadge) header.appendChild(countBadge);
    }

    // Handle REPL Input
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value;
            vscode.postMessage({ type: 'evaluate', value: cmd });
            input.value = '';
        }
    });

    function renderStructured(container, data) {
        const header = document.createElement('div');
        header.className = 'header';
        const severity = (data.severity || 'info').toLowerCase();
        
        // Use inline SVGs injected by the provider; fall back to a colored placeholder.
        const svgMap = window.__ICON_SVGS__ || {};
        const resolvedSeverity = severity === 'warn' ? 'warning' : severity;
        const iconSvg = svgMap[resolvedSeverity] || svgMap[severity];
        const iconHtml = iconSvg ? iconSvg : `<span class="icon-placeholder"></span>`;

        // Add timestamp (if present) on the far right of header
        const ts = formatTimestamp(data);
        const tsSpanHtml = ts ? `<span class="timestamp">${escapeHtml(ts)}</span>` : '';
        header.innerHTML = `<span class="badge severity-${severity}">${iconHtml}</span> <span>${escapeHtml(data.message)}</span> ${tsSpanHtml}`;

        const details = document.createElement('div');
        details.className = 'details';

        // Always render exceptions (tracebacks) if present
        if (data.exception) {
            const exceptionDiv = renderException(data.exception);
            details.appendChild(exceptionDiv);
        }

        // Render the `metadata` field (if present) as separate key entries
        if (data.metadata && typeof data.metadata === 'object') {
            let metaHtml = '';
            for (const [mKey, mVal] of Object.entries(data.metadata)) {
                metaHtml += `<div><span class="json-key">${escapeHtml(mKey)}:</span> <span class="json-val">${escapeHtml(JSON.stringify(mVal))}</span></div>`;
            }
            if (metaHtml) {
                const metaDiv = document.createElement('div');
                metaDiv.className = 'meta-block';
                metaDiv.innerHTML = metaHtml;
                details.appendChild(metaDiv);
            }
        }

        header.addEventListener('click', () => {
            details.classList.toggle('open');
        });

        container.appendChild(header);
        container.appendChild(details);
    }

    // Helper: format timestamp from common possible fields
    function formatTimestamp(data) {
        const candidates = [data.timestamp, data.time, data.ts, data.t, data.time_iso, data.ts_iso];
        for (const c of candidates) {
            if (!c && c !== 0) continue;
            try {
                // If it's numeric (epoch seconds or ms)
                if (typeof c === 'number') {
                    // Heuristic: if > 1e12 treat as ms, else seconds
                    const ms = c > 1e12 ? c : (c > 1e10 ? c : c * 1000);
                    const d = new Date(ms);
                    if (!isNaN(d.getTime())) return d.toLocaleTimeString();
                }
                if (typeof c === 'string') {
                    // Try parse as ISO or numeric string
                    const n = Number(c);
                    if (!Number.isNaN(n)) {
                        const ms = n > 1e12 ? n : (n > 1e10 ? n : n * 1000);
                        const d = new Date(ms);
                        if (!isNaN(d.getTime())) return d.toLocaleTimeString();
                    }
                    const d2 = new Date(c);
                    if (!isNaN(d2.getTime())) return d2.toLocaleTimeString();
                }
            } catch (e) {
                // ignore and try next
            }
        }
        return '';
    }

    function renderException(exceptionData) {
        const container = document.createElement('div');
        container.className = 'exception-container';
        
        const header = document.createElement('div');
        header.className = 'exception-header';
        header.textContent = '🔥 Exception Traceback';
        container.appendChild(header);
        
        // Parse exception data if it's a string
        let exceptions = [];
        try {
            exceptions = typeof exceptionData === 'string' ? JSON.parse(exceptionData) : exceptionData;
        } catch (e) {
            container.textContent = 'Error parsing exception: ' + exceptionData;
            return container;
        }
        
        if (!Array.isArray(exceptions)) {
            exceptions = [exceptions];
        }
        
        // Render exception chain (reverse order - innermost first)
        const chainDiv = document.createElement('div');
        chainDiv.className = 'exception-chain';
        
        for (let i = exceptions.length - 1; i >= 0; i--) {
            const exc = exceptions[i];
            const excDiv = document.createElement('div');
            excDiv.className = 'exception-item';
            
            // Exception type and message
            const excHeader = document.createElement('div');
            excHeader.innerHTML = `<span class="exception-type">${escapeHtml(exc.exc_type || 'Exception')}</span><span class="exception-message">: ${escapeHtml(exc.exc_value || '')}</span>`;
            excDiv.appendChild(excHeader);
            
            // Cause indicator
            if (exc.is_cause && i < exceptions.length - 1) {
                const causeDiv = document.createElement('div');
                causeDiv.className = 'exception-cause';
                causeDiv.textContent = '↑ The above exception was the direct cause of:';
                excDiv.appendChild(causeDiv);
            }
            
            // Stack frames
            if (exc.frames && exc.frames.length > 0) {
                const framesDiv = document.createElement('div');
                framesDiv.style.marginTop = '8px';
                
                exc.frames.forEach((frame) => {
                    const frameDiv = document.createElement('div');
                    frameDiv.className = 'stack-frame';
                    
                    // Create clickable link
                    const link = document.createElement('a');
                    link.href = '#';
                    link.textContent = `${frame.filename}:${frame.lineno}`;
                    link.onclick = (e) => {
                        e.preventDefault();
                        vscode.postMessage({
                            type: 'openFile',
                            file: frame.filename,
                            line: frame.lineno
                        });
                    };
                    
                    frameDiv.appendChild(document.createTextNode('  File '));
                    frameDiv.appendChild(link);
                    frameDiv.appendChild(document.createTextNode(`, in ${escapeHtml(frame.name)}`));
                    
                    // Request code line from extension
                    const codeDiv = document.createElement('div');
                    codeDiv.className = 'stack-code';
                    codeDiv.textContent = 'Loading...';
                    frameDiv.appendChild(codeDiv);
                    
                    // Request the line content
                    const requestId = `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    pendingCodeRequests.set(requestId, codeDiv);
                    
                    // Set timeout to prevent hanging
                    setTimeout(() => {
                        if (pendingCodeRequests.has(requestId)) {
                            codeDiv.textContent = '(timeout loading code)';
                            codeDiv.style.opacity = '0.5';
                            pendingCodeRequests.delete(requestId);
                        }
                    }, 2000);
                    
                    vscode.postMessage({
                        type: 'getCodeLine',
                        requestId: requestId,
                        file: frame.filename,
                        line: frame.lineno
                    });
                    
                    // Show locals if available
                    if (frame.locals && Object.keys(frame.locals).length > 0) {
                        const localsDiv = document.createElement('div');
                        localsDiv.className = 'stack-locals';
                        const localsList = Object.entries(frame.locals)
                            .map(([k, v]) => `${k} = ${v}`)
                            .join(', ');
                        localsDiv.textContent = `    ${localsList}`;
                        frameDiv.appendChild(localsDiv);
                    }
                    
                    framesDiv.appendChild(frameDiv);
                });
                
                excDiv.appendChild(framesDiv);
            }
            
            chainDiv.appendChild(excDiv);
        }
        
        container.appendChild(chainDiv);
        return container;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
})();
