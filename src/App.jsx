import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  MantineProvider,
  createTheme,
  AppShell,
  Group,
  Badge,
  Button,
  Text,
  Stack,
  ActionIcon,
  Progress,
  Paper,
  UnstyledButton,
  Checkbox,
  TagsInput,
  Menu,
  Tooltip,
  Modal,
  Alert,
  Transition,
  Collapse,
  Overlay,
  SegmentedControl,
  Portal,
} from '@mantine/core';
import {
  IconFolderPlus,
  IconTrash,
  IconSearch,
  IconCancel,
  IconCopy,
  IconFolder,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconSettings,
  IconX,
  IconEye,
  IconFilter,
  IconExternalLink,
  IconWand,
  IconChevronDown as IconChevronDownSmall,
  IconCheck,
  IconShield,
  IconShieldFilled,
  IconAlertTriangle,
  IconRefresh,
  IconSettings2,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconFileText,
  IconArchive,
  IconGift,
} from '@tabler/icons-react';
import '@mantine/core/styles.css';
import SettingsModal from './SettingsModal';
import TreeMap from './TreeMap';
import { DEFAULT_SETTINGS } from './defaults';

const brownPalette = [
  '#fcf3f0',
  '#e9e6e5',
  '#cfcccb',
  '#b4afae',
  '#9e9795',
  '#908885',
  '#8b7f7c',
  '#796d69',
  '#6b5e5a',
  '#63514c',
];

const theme = createTheme({
  colors: {
    brown: brownPalette,
  },
  primaryColor: 'brown',
});

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function DirectoryPanel({ directories, onRemove, disabled, protectedDirs, onToggleProtected }) {
  if (directories.length === 0) return null;

  return (
    <Stack gap="xs">
      <Text fw={600}>Directories to Scan{protectedDirs.size > 0 ? ` (${protectedDirs.size} Protected)` : ''}</Text>
      <Group gap="xs" wrap="wrap">
        {directories.map((dir) => {
          const isProtected = protectedDirs.has(dir);
          return (
            <Tooltip
              key={dir}
              label={isProtected ? 'Unmark as reference' : 'Mark as reference'}
              //position="bottom-start"
              transitionProps={{ transition: 'fade', duration: 200 }}
              openDelay={300}
              //position="bottom"
              //color={'dark'}
              disabled={disabled}
            >
            <Badge
              size="lg"
              variant={isProtected ? 'light' : 'outline'}
              color={isProtected ? '#7fd1ae' : 'brown'}
              pr={3}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
              className="dir-badge"
              onClick={() => !disabled && onToggleProtected(dir)}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="gray"
                  onClick={(e) => { e.stopPropagation(); onRemove(dir); }}
                  disabled={disabled}
                >
                  <IconX size={14} />
                </ActionIcon>
              }
              leftSection={isProtected ? <IconShieldFilled size={14} /> : <IconFolder size={14} />}
            >
              {dir}
            </Badge>
            </Tooltip>
          );
        })}
      </Group>
    </Stack>
  );
}

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SortHeader({ label, field, sortBy, sortDir, onSort }) {
  const Icon = sortBy === field ? (sortDir === 'asc' ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <UnstyledButton onClick={() => onSort(field)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Text fw={600} size="sm">{label}</Text>
      <Icon size={14} stroke={1.5} />
    </UnstyledButton>
  );
}

function PreviewPanel({ filePath, onClose, isOpen, width }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPreview(null);
    window.api.readFilePreview(filePath).then((result) => {
      if (!cancelled) {
        setPreview(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setPreview({ type: 'error' });
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [filePath]);

  const fileName = filePath.split('/').pop() || filePath.split('\\').pop();

  return (
    <Paper
      style={{
        width: width,
        height: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--mantine-color-dark-4)',
        overflow: 'hidden',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <Group p="xs" justify="space-between" style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <Group gap="xs">
          <IconEye size={16} />
          <Text size="sm" fw={600} truncate="end" style={{ maxWidth: 260 }} title={fileName}>
            {fileName}
          </Text>
        </Group>
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={onClose}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading && <Text c="dimmed" size="sm">Loading preview…</Text>}
        {!loading && preview?.type === 'image' && (
          <img
            src={preview.dataUrl}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
          />
        )}
        {!loading && preview?.type === 'text' && (
          <pre style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'var(--mantine-color-gray-4)',
          }}>
            {preview.content}
            {preview.truncated && <Text c="dimmed" size="xs" mt="xs">(truncated)</Text>}
          </pre>
        )}
        {!loading && preview?.type === 'video' && (
          <video controls src={preview.dataUrl} style={{ maxWidth: '100%', borderRadius: 4 }} />
        )}
        {!loading && preview?.type === 'audio' && (
          <audio controls src={preview.dataUrl} style={{ width: '100%' }} />
        )}
        {!loading && (preview?.type === 'unsupported' || preview?.type === 'error') && (
          <Stack align="center" justify="center" style={{ height: '100%' }}>
            <Text c="dimmed" size="sm">Preview not available for this file type.</Text>
          </Stack>
        )}
      </div>
    </Paper>
  );
}

const TAG_EXTENSIONS = {
  Images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff', 'ico', 'heic', 'heif', 'raw', 'cr2', 'nef', 'arw'],
  Video: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'aiff', 'alac'],
  Documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'epub', 'md'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'pkg', 'deb', 'rpm'],
};
const TAG_SUGGESTIONS = Object.keys(TAG_EXTENSIONS);

const TAG_ICONS = {
  Images: IconPhoto,
  Video: IconVideo,
  Audio: IconMusic,
  Documents: IconFileText,
  Archives: IconArchive,
};

function TagOption({ option }) {
  const Icon = TAG_ICONS[option.value];
  return (
    <Group gap="xs">
      {Icon && <Icon size={14} />}
      <span>{option.value}</span>
    </Group>
  );
}

function matchesTag(filePath, tag) {
  const exts = TAG_EXTENSIONS[tag];
  if (exts) {
    const lower = filePath.toLowerCase();
    return exts.some((ext) => lower.endsWith('.' + ext));
  }
  const trimmed = tag.trim();
  if (!trimmed) return true;
  if (trimmed.includes('*') || trimmed.includes('?')) {
    const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    try {
      return new RegExp(regexStr, 'i').test(filePath);
    } catch {
      return true;
    }
  }
  return filePath.toLowerCase().includes(trimmed.toLowerCase());
}

function matchesFilter(filePath, filters) {
  if (!filters || filters.length === 0) return true;
  return filters.some((tag) => matchesTag(filePath, tag));
}

function ResultsPanel({ duplicates, scanning, progress, unusedPaths, onToggleUnused, onAutoSelect, onClearSelection, autoSelectStrategy, selectedPath, onSelectPreview, onDeleteFile, onDeleteSelected, hasProtectedDirs, deleting, deleteProgress, onNewScan, filter, onFilterChange }) {
  const autoSelectStrategies = [
    { key: 'oldest', label: 'Keep oldest (modified time)' },
    { key: 'newest', label: 'Keep newest (modified time)' },
    { key: 'shortest', label: 'Keep shortest filename' },
    { key: 'shallowest', label: 'Keep shallowest path' },
    { key: 'reference', label: 'Keep reference only', needsProtected: true },
  ];
  const [sortBy, setSortBy] = useState('size');
  const [sortDir, setSortDir] = useState('desc');
  const [contextMenu, setContextMenu] = useState(null);
  const filterInputRef = useRef(null);

  const selectedSize = useMemo(() => {
    let size = 0;
    if (!duplicates) return 0;
    for (const group of duplicates) {
      for (const file of group) {
        if (unusedPaths.has(file.filePath)) {
          size += file.size;
        }
      }
    }
    return size;
  }, [duplicates, unusedPaths]);

  const handleContextMenu = useCallback((e, filePath) => {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 200;
    const menuH = 130;
    const gap = 8;
    const x = e.clientX + gap + menuW > window.innerWidth ? e.clientX - menuW - gap : e.clientX + gap;
    const y = e.clientY + gap + menuH > window.innerHeight ? e.clientY - menuH - gap : e.clientY + gap;
    setContextMenu({ x: Math.max(0, x), y: Math.max(0, y), filePath });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  const handleSort = useCallback((field) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const sortedGroups = useMemo(() => {
    if (!duplicates || duplicates.length === 0) return [];
    const groups = duplicates.map((group, gi) => ({
      files: group.map((file) => ({ ...file, groupIndex: gi + 1 })),
    }));
    // Sort groups by aggregate value
    groups.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = a.files[0].filePath.localeCompare(b.files[0].filePath); break;
        case 'size': cmp = a.files[0].size - b.files[0].size; break;
        case 'modified': cmp = Math.max(...a.files.map(f => f.mtime || 0)) - Math.max(...b.files.map(f => f.mtime || 0)); break;
        default: cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    // Sort files within each group
    for (const g of groups) {
      g.files.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'name': cmp = a.filePath.localeCompare(b.filePath); break;
          case 'size': cmp = a.size - b.size; break;
          case 'modified': cmp = (a.mtime || 0) - (b.mtime || 0); break;
          default: cmp = a.filePath.localeCompare(b.filePath);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return groups;
  }, [duplicates, sortBy, sortDir]);

  const filteredGroups = useMemo(() => {
    if (filter.length === 0) return sortedGroups;
    return sortedGroups.map((g) => ({
      ...g,
      files: g.files.filter((f) => matchesFilter(f.filePath, filter)),
    })).filter((g) => g.files.length > 0);
  }, [sortedGroups, filter]);

  const displayRows = useMemo(() => {
    const rows = [];
    for (let gi = 0; gi < filteredGroups.length; gi++) {
      if (gi > 0) rows.push({ type: 'spacer' });
      for (const file of filteredGroups[gi].files) {
        rows.push({ type: 'data', file });
      }
    }
    return rows;
  }, [filteredGroups]);

  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => displayRows[i].type === 'spacer' ? 18 : 36,
    overscan: 20,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [displayRows]);

  if (scanning) {
    const { phase, fileCount = 0, candidateCount = 0, hashed = 0, currentFile = '' } = progress;
    const pct = phase === 'hashing' && candidateCount > 0 ? Math.round((hashed / candidateCount) * 100) : 0;
    return (
      <Stack p="md">
        <Text fw={600}>
          {phase === 'collecting'
            ? `Collecting files… (${fileCount} found)`
            : `Hashing candidates… ${hashed} / ${candidateCount}`}
        </Text>
        {phase === 'hashing' && <Progress value={pct} animated />}
        <Text c="dimmed" truncate="end" style={{ fontFamily: 'monospace' }}>
          {currentFile}
        </Text>
      </Stack>
    );
  }

  if (!duplicates) {
    return (
      <Stack align="center" justify="center" style={{ flex: 1 }} p="xl">
        <IconSearch size={48} stroke={1} style={{ color: 'var(--mantine-color-dimmed)' }} />
        <Text c="dimmed" size="lg" fw={500}>
          Add directories above and click Scan to find duplicates.
        </Text>
        <Text c="dimmed" size="sm" align="center" style={{ maxWidth: 400 }}>
          <em>Tip: Click on any directory to mark it as a <strong>reference</strong> (files in that directory will be protected from deletion).</em>
        </Text>
      </Stack>
    );
  }

  if (duplicates.length === 0) {
    return (
      <Stack align="center" justify="center" style={{ flex: 1 }} p="xl">
        <Text size="lg" fw={500}>No duplicates found</Text>
        <Text c="dimmed">All files in the scanned directories are unique.</Text>
      </Stack>
    );
  }

  const totalCopies = duplicates.reduce((sum, g) => sum + g.length, 0);
  const extraCopies = duplicates.reduce((sum, g) => sum + (g.length - 1), 0);
  const totalSize = duplicates.reduce((sum, g) => sum + g[0].size * g.length, 0);
  const savableSize = duplicates.reduce((sum, g) => sum + g[0].size * (g.length - 1), 0);

  const isFiltered = filter.length > 0;
  const filteredCopies = isFiltered ? filteredGroups.reduce((sum, g) => sum + g.files.length, 0) : totalCopies;
  const filteredExtraCopies = isFiltered ? filteredGroups.reduce((sum, g) => sum + (g.files.length - 1), 0) : extraCopies;
  const filteredTotalSize = isFiltered ? filteredGroups.reduce((sum, g) => sum + g.files.reduce((s, f) => s + f.size, 0), 0) : totalSize;
  const filteredSavableSize = isFiltered ? filteredGroups.reduce((sum, g) => { const sz = g.files[0]?.size || 0; return sum + sz * (g.files.length - 1); }, 0) : savableSize;

  return (
    <Stack p="sm" style={{ flex: 1, minHeight: 0 }}>
      <Group gap="xs">
        <Text fw={600}>Results</Text>
        <Text c="#00bdff" size="sm">
          {isFiltered ? filteredGroups.length.toLocaleString() : duplicates.length.toLocaleString()} duplicated files · {filteredExtraCopies.toLocaleString()} {filteredExtraCopies === 1 ? 'copy' : 'copies'} · {formatSize(filteredTotalSize)} total · {formatSize(filteredSavableSize)} reclaimable space
        </Text>
      </Group>
      <Group justify="space-between">
        <Group>
          <TagsInput
          ref={filterInputRef}
          variant="transparent"
          placeholder={filter.length === 0 ? 'Filter' : 'Add Filter'}
          size="sm"
          leftSection={<IconFilter size={14} color={isFiltered ? '#00bdff' : undefined} fill={isFiltered ? '#00bdff' : 'none'} />}
          value={filter}
          onChange={onFilterChange}
          data={TAG_SUGGESTIONS}
          renderOption={TagOption}
          onOptionSubmit={() => setTimeout(() => filterInputRef.current?.blur(), 0)}
          comboboxProps={{ width: 200, position: 'bottom-start', transitionProps: { transition: 'pop', duration: 200 } }}
          //clearable
          style={{ width: '100%' }}
        />
          <Menu shadow="md" width={260} position="bottom-start">
            <Menu.Target>
              <Button size="xs" variant="light"  rightSection={<IconChevronDownSmall size={14} />}>
                Auto-Select Duplicates
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Select all except…</Menu.Label>
              {autoSelectStrategies.map((s) => (
                <Menu.Item
                  key={s.key}
                  onClick={() => onAutoSelect(s.key, filter)}
                  rightSection={autoSelectStrategy === s.key ? <IconCheck size={14} /> : null}
                  disabled={s.needsProtected && !hasProtectedDirs}
                >
                  {s.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          
          <Button size="xs" variant="filled"  leftSection={<IconTrash size={14} />} onClick={onDeleteSelected} disabled={unusedPaths.size === 0}>
            Delete ({unusedPaths.size.toLocaleString()}{unusedPaths.size > 0 ? ` · ${formatSize(selectedSize)}` : ''})
          </Button>
          {unusedPaths.size > 0 && (
            <Button size="xs" variant="subtle" color="gray" leftSection={<IconX size={14} />} onClick={onClearSelection}>
              Clear
            </Button>
          )}
        </Group>
        
      </Group>
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{ width: 36, flexShrink: 0 }} />
        <div style={{ flex: 1, padding: '8px' }}>
          <SortHeader label="File" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
        </div>
        <div style={{ width: 100, flexShrink: 0, padding: '8px' }}>
          <SortHeader label="Size" field="size" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
        </div>
        <div style={{ width: 130, flexShrink: 0, padding: '8px' }}>
          <SortHeader label="Modified" field="modified" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
        </div>
      </div>
      <div ref={parentRef} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = displayRows[vRow.index];
            if (row.type === 'spacer') {
              return (
                <div
                  key={`spacer-${vRow.index}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: vRow.size,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                />
              );
            }
            const { file } = row;
            const isUnused = unusedPaths.has(file.filePath);
            const isSelected = selectedPath === file.filePath;
            return (
              <div
                key={`${file.groupIndex}-${file.filePath}`}
                className={`data-row${isSelected ? ' data-row-selected' : ''}`}
                onClick={() => onSelectPreview(file.filePath)}
                onContextMenu={(e) => handleContextMenu(e, file.filePath)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vRow.size,
                  transform: `translateY(${vRow.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    size="xs"
                    checked={isUnused}
                    onChange={() => onToggleUnused(file.filePath)}
                    color="#009ff5"
                  />
                </div>
                <div style={{ flex: 1, padding: '6px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.875rem' }}
                  title={file.filePath}
                >
                  {file.filePath}
                </div>
                <div style={{ width: 100, flexShrink: 0, padding: '6px 8px' }}>{formatSize(file.size)}</div>
                <div style={{ width: 130, flexShrink: 0, padding: '6px 8px' }}>{formatDate(file.mtime)}</div>
              </div>
            );
          })}
        </div>
      </div>
      {contextMenu && (
        <Portal>
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--mantine-color-dark-6)',
              border: '1px solid var(--mantine-color-dark-4)',
              borderRadius: 6,
              padding: '4px 0',
              zIndex: 1000,
              minWidth: 180,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <button
              onClick={() => {
                window.api.openFile(contextMenu.filePath);
                setContextMenu(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: 'var(--mantine-color-white)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mantine-color-dark-4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <IconExternalLink size={16} />
              Open with Default App
            </button>
            <button
              onClick={() => {
                window.api.showItemInFolder(contextMenu.filePath);
                setContextMenu(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: 'var(--mantine-color-white)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mantine-color-dark-4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <IconFolder size={16} />
              Open File Location
            </button>
            <div style={{ height: 1, background: 'var(--mantine-color-dark-4)', margin: '4px 0' }} />
            <button
              onClick={async () => {
                const filePath = contextMenu.filePath;
                setContextMenu(null);
                try {
                  await window.api.trashFile(filePath);
                  onDeleteFile(filePath);
                } catch (err) {
                  console.error('Failed to trash file:', err);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                color: 'var(--mantine-color-red-5)',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--mantine-color-dark-4)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <IconTrash size={16} />
              Delete
            </button>
          </div>
        </Portal>
      )}
    </Stack>
  );
}

export default function App() {
  const [directories, setDirectories] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState(null);
  const [progress, setProgress] = useState({});
  const [unusedPaths, setUnusedPaths] = useState(new Set());
  const [autoSelectStrategy, setAutoSelectStrategy] = useState(null);
  const [protectedDirs, setProtectedDirs] = useState(new Set());
  const [previewPath, setPreviewPath] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [displayedPreviewPath, setDisplayedPreviewPath] = useState(null);
  const [previewWidth, setPreviewWidth] = useState(360);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState([]);
  const [updateState, setUpdateState] = useState('none'); // 'none' | 'downloading' | 'ready'
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [view, setView] = useState('scanner'); // 'scanner' | 'treemap'
  const [treemapToolbarEl, setTreemapToolbarEl] = useState(null);

  useEffect(() => {
    const unsubAvail = window.api.onUpdateAvailable?.(() => {
      setUpdateState('downloading');
    });
    const unsubReady = window.api.onUpdateDownloaded?.(() => {
      setUpdateState('ready');
    });
    return () => {
      if (unsubAvail) unsubAvail();
      if (unsubReady) unsubReady();
    };
  }, []);

  useEffect(() => {
    window.api.getSettings().then(setSettings);
  }, []);

  const handleSaveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    window.api.saveSettings(newSettings);
  }, []);

  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });
  const [overlapWarning, setOverlapWarning] = useState(null);
  const isDragging = useRef(false);
  const deleteAbort = useRef(false);
  const cleanupRefs = useRef([]);

  useEffect(() => {
    if (previewPath) setDisplayedPreviewPath(previewPath);
  }, [previewPath]);

  const handlePreviewTransitionEnd = useCallback(() => {
    if (!previewPath) setDisplayedPreviewPath(null);
  }, [previewPath]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = previewWidth;
    const onMouseMove = (e) => {
      if (!isDragging.current) return;
      const delta = startX - e.clientX;
      setPreviewWidth(Math.max(200, Math.min(800, startWidth + delta)));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [previewWidth]);

  useEffect(() => {
    const unsub1 = window.api.onScanProgress((data) => {
      setProgress(data);
    });
    const unsub2 = window.api.onScanComplete((data) => {
      setScanning(false);
      if (!data.cancelled) {
        setDuplicates(data.duplicates);
      }
    });
    cleanupRefs.current = [unsub1, unsub2];
    return () => {
      cleanupRefs.current.forEach((fn) => fn());
    };
  }, []);

  const handleAddDirectory = useCallback(async () => {
    const dir = await window.api.selectDirectory();
    if (!dir || directories.includes(dir)) return;
    if (settings.recursive !== false) {
      const sep = dir.includes('\\') ? '\\' : '/';
      const overlap = directories.some(
        (d) => dir.startsWith(d + sep) || d.startsWith(dir + sep)
      );
      if (overlap) {
        setOverlapWarning(dir);
        return;
      }
    }
    setDirectories((prev) => [...prev, dir]);
  }, [directories, settings.recursive]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (scanning || window.api.isFlatpak) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const paths = [];
    for (let i = 0; i < files.length; i++) {
      paths.push(window.api.getPathForFile(files[i]));
    }

    const dirs = await window.api.filterDirectories(paths);

    setDirectories((prev) => {
      let updated = [...prev];
      for (const dir of dirs) {
        if (updated.includes(dir)) continue;
        if (settings.recursive !== false) {
          const sep = dir.includes('\\') ? '\\' : '/';
          const overlap = updated.some(
            (d) => dir.startsWith(d + sep) || d.startsWith(dir + sep)
          );
          if (overlap) {
            setOverlapWarning(dir);
            continue;
          }
        }
        updated.push(dir);
      }
      return updated;
    });
  }, [scanning]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!scanning && !window.api.isFlatpak && e.dataTransfer.types.includes('Files')) setDragOver(true);
  }, [scanning]);

  const handleDragLeave = useCallback((e) => {
    if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  }, []);

  const handleRemoveDirectory = useCallback((dir) => {
    setDirectories((prev) => prev.filter((d) => d !== dir));
    setProtectedDirs((prev) => {
      if (!prev.has(dir)) return prev;
      const next = new Set(prev);
      next.delete(dir);
      return next;
    });
  }, []);

  const handleToggleProtected = useCallback((dir) => {
    setProtectedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }, []);

  const handleScan = useCallback(() => {
    setScanning(true);
    setDuplicates(null);
    setProgress({});
    window.api.startScan(directories, {
      cacheEnabled: settings.cacheEnabled,
      minFileSizeKb: settings.minFileSizeKb,
      scanMode: settings.scanMode,
      recursive: settings.recursive,
    });
  }, [directories, settings.cacheEnabled, settings.minFileSizeKb, settings.scanMode, settings.recursive]);

  const handleCancel = useCallback(() => {
    window.api.cancelScan();
    setScanning(false);
  }, []);

  const handleToggleUnused = useCallback((filePath) => {
    setUnusedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const isInProtectedDir = useCallback((filePath) => {
    for (const dir of protectedDirs) {
      if (filePath.startsWith(dir + '/') || filePath.startsWith(dir + '\\')) return true;
    }
    return false;
  }, [protectedDirs]);

  const handleAutoSelect = useCallback((strategy, filter) => {
    if (!duplicates) return;
    const paths = new Set();
    for (const group of duplicates) {
      const filtered = filter?.length > 0
        ? group.filter((f) => matchesFilter(f.filePath, filter))
        : group;
      if (filtered.length < 2) continue;

      // If any files are in protected dirs, always keep those
      const protectedIndices = filtered.map((f, i) => isInProtectedDir(f.filePath) ? i : -1).filter(i => i >= 0);

      let keepIndex;
      if (protectedIndices.length > 0) {
        keepIndex = protectedIndices[0];
      } else if (strategy === 'reference') {
        continue;
      } else {
        const name = (fp) => fp.split('/').pop() || fp.split('\\').pop();
        const relativePath = (fp) => {
          for (const dir of directories) {
            if (fp.startsWith(dir + '/') || fp.startsWith(dir + '\\')) return fp.slice(dir.length + 1);
          }
          return fp;
        };
        const depth = (fp) => relativePath(fp).split('/').length;

        const comparators = {
          oldest: (a, b) => (a.mtime || 0) - (b.mtime || 0),
          newest: (a, b) => (b.mtime || 0) - (a.mtime || 0),
          shortest: (a, b) => name(a.filePath).length - name(b.filePath).length,
          shallowest: (a, b) => depth(a.filePath) - depth(b.filePath),
          shortestPath: (a, b) => relativePath(a.filePath).length - relativePath(b.filePath).length,
          alphabetical: (a, b) => a.filePath.localeCompare(b.filePath),
        };

        const tiebreakers = {
          oldest: ['oldest', 'shortest', 'alphabetical'],
          newest: ['newest', 'shallowest', 'alphabetical'],
          shortest: ['shortest', 'shallowest', 'shortestPath', 'alphabetical'],
          shallowest: ['shallowest', 'shortestPath', 'shortest', 'alphabetical'],
        };

        const chain = tiebreakers[strategy] || ['alphabetical'];
        keepIndex = filtered.reduce((best, f, i) => {
          for (const key of chain) {
            const cmp = comparators[key](f, filtered[best]);
            if (cmp < 0) return i;
            if (cmp > 0) return best;
          }
          return best;
        }, 0);
      }
      for (let i = 0; i < filtered.length; i++) {
        // Never mark protected files for deletion
        if (i !== keepIndex && !isInProtectedDir(filtered[i].filePath)) {
          paths.add(filtered[i].filePath);
        }
      }
    }
    setUnusedPaths(paths);
    setAutoSelectStrategy(strategy);
  }, [duplicates, directories, isInProtectedDir]);

  const handleClearSelection = useCallback(() => {
    setUnusedPaths(new Set());
    setAutoSelectStrategy(null);
  }, []);

  const handleNewScan = useCallback(() => {
    setDirectories([]);
    setDuplicates(null);
    setProgress({});
    setUnusedPaths(new Set());
    setAutoSelectStrategy(null);
    setProtectedDirs(new Set());
    setPreviewPath(null);
    setSelectedPath(null);
    setFilter([]);
  }, []);

  const handleSelectPreview = useCallback((filePath) => {
    setSelectedPath(filePath);
    setPreviewPath((prev) => (prev === filePath ? null : filePath));
  }, []);

  const handleDeleteFile = useCallback((filePath) => {
    setDuplicates((prev) => {
      if (!prev) return prev;
      const updated = prev
        .map((group) => group.filter((f) => f.filePath !== filePath))
        .filter((group) => group.length >= 2);
      return updated;
    });
    setUnusedPaths((prev) => {
      if (!prev.has(filePath)) return prev;
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
    setPreviewPath((prev) => (prev === filePath ? null : prev));
    setSelectedPath((prev) => (prev === filePath ? null : prev));
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    const CONCURRENCY = 3;
    const paths = Array.from(unusedPaths);
    setShowDeleteConfirm(false);
    setDeleting(true);
    deleteAbort.current = false;
    setDeleteProgress({ done: 0, total: paths.length });

    const successfullyDeleted = new Set();
    let done = 0;

    for (let i = 0; i < paths.length; i += CONCURRENCY) {
      if (deleteAbort.current) break;
      const batch = paths.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((p) => window.api.trashFile(p))
      );
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successfullyDeleted.add(batch[idx]);
        } else {
          console.error('Failed to trash file:', batch[idx], result.reason);
        }
      });
      done += batch.length;
      setDeleteProgress({ done, total: paths.length });
    }

    setDuplicates((prev) => {
      if (!prev) return prev;
      return prev
        .map((group) => group.filter((f) => !successfullyDeleted.has(f.filePath)))
        .filter((group) => group.length >= 2);
    });

    setUnusedPaths((prev) => {
      const next = new Set(prev);
      successfullyDeleted.forEach(path => next.delete(path));
      return next;
    });

    setPreviewPath((prev) => (successfullyDeleted.has(prev) ? null : prev));
    setSelectedPath((prev) => (successfullyDeleted.has(prev) ? null : prev));
    setDeleting(false);
  }, [unusedPaths]);

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppShell
        padding={0}
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Stack gap={0} style={{ height: '100vh' }}>
          {/* Shared anchored header */}
          <Paper p="sm" style={{ flexShrink: 0, zIndex: 1 }}>
            <Group justify="space-between">
              <Group gap="sm">
                <SegmentedControl
                  value={view}
                  onChange={setView}
                  size="xs"
                  data={[
                    { label: 'Duplicates', value: 'scanner' },
                    { label: 'Disk Usage', value: 'treemap' },
                  ]}
                />
                <Tooltip label="Settings" openDelay={300}>
                  <ActionIcon variant="subtle" size="lg" onClick={() => setSettingsOpen(true)} disabled={view === 'scanner' && scanning}>
                    <IconSettings2 size={18} />
                  </ActionIcon>
                </Tooltip>
                {updateState === 'ready' && (
                  <Tooltip label="Update ready to install" openDelay={300}>
                    <ActionIcon 
                      variant="subtle" 
                      color="blue" 
                      size="lg" 
                      onClick={() => setShowUpdateModal(true)}
                    >
                      <IconGift size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', alignSelf: 'stretch' }}>
                {/* Scanner toolbar - enters from right */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  position: 'absolute',
                  inset: 0,
                  transform: view === 'scanner' ? 'translateY(0)' : 'translateY(6px)',
                  opacity: view === 'scanner' ? 1 : 0,
                  transition: 'transform 0.25s ease, opacity 0.25s ease',
                  pointerEvents: view === 'scanner' ? 'auto' : 'none',
                }}>
                  <Group gap="xs">
                    <Button
                      variant="light"
                      leftSection={<IconFolderPlus size={16} />}
                      onClick={handleAddDirectory}
                      disabled={scanning}
                    >
                      Add Folder
                    </Button>
                    {scanning ? (
                      <Button
                        //color="red"
                        variant="filled"
                        leftSection={<IconCancel size={16} />}
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <>
                        <Button
                          leftSection={duplicates ? <IconRefresh size={16} /> : <IconSearch size={16} />}
                          onClick={handleScan}
                          disabled={directories.length === 0}
                        >
                          {duplicates ? 'Rescan' : 'Scan for Duplicates'}
                        </Button>
                        {duplicates && (
                          <Button
                            leftSection={<IconSearch size={16} />}
                            onClick={handleNewScan}
                          >
                            New Scan
                          </Button>
                        )}
                      </>
                    )}
                  </Group>
                </div>
                {/* Treemap toolbar - enters from left */}
                <div
                  ref={setTreemapToolbarEl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--mantine-spacing-sm)',
                    position: 'absolute',
                    inset: 0,
                    transform: view === 'treemap' ? 'translateY(0)' : 'translateY(6px)',
                    opacity: view === 'treemap' ? 1 : 0,
                    transition: 'transform 0.25s ease, opacity 0.25s ease',
                    pointerEvents: view === 'treemap' ? 'auto' : 'none',
                  }}
                />
              </div>
            </Group>
          </Paper>

          {/* Transitioning content area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Disk Usage view - enters from left */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              transform: view === 'treemap' ? 'translateX(0)' : 'translateX(-40px)',
              opacity: view === 'treemap' ? 1 : 0,
              transition: 'transform 0.35s ease, opacity 0.35s ease',
              pointerEvents: view === 'treemap' ? 'auto' : 'none',
            }}>
              <TreeMap toolbarTarget={treemapToolbarEl} />
            </div>

            {/* Duplicates view - enters from right */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              transform: view === 'scanner' ? 'translateX(0)' : 'translateX(40px)',
              opacity: view === 'scanner' ? 1 : 0,
              transition: 'transform 0.35s ease, opacity 0.35s ease',
              pointerEvents: view === 'scanner' ? 'auto' : 'none',
            }}>
              {/* Overlap warning */}
              <Collapse in={!!overlapWarning} transitionDuration={250}>
                <Alert
                  variant="light"
                  color="brown"
                 // title="Directory already included"
                  icon={<IconAlertTriangle size={18} />}
                  withCloseButton
                  onClose={() => setOverlapWarning(null)}
                  mx="sm"
                  mt="xs"
                >
                  <Text size="sm">
                    <strong>{overlapWarning}</strong> overlaps with a directory below. To scan parent and child directories independently, disable <em>Recursive scan</em> in Settings.
                  </Text>
                </Alert>
              </Collapse>

              {/* Directory list */}
              {!!directories.length &&
              <Paper p="sm" style={{ flexShrink: 0, maxHeight: '30vh', overflowY: 'auto' }}>
                <DirectoryPanel
                  directories={directories}
                  onRemove={handleRemoveDirectory}
                  disabled={scanning}
                  protectedDirs={protectedDirs}
                  onToggleProtected={handleToggleProtected}
                />
              </Paper>
              }

              {/* Main panel: results + preview */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                  <ResultsPanel duplicates={duplicates} scanning={scanning} progress={progress} unusedPaths={unusedPaths} onToggleUnused={handleToggleUnused} onAutoSelect={handleAutoSelect} onClearSelection={handleClearSelection} autoSelectStrategy={autoSelectStrategy} selectedPath={selectedPath} onSelectPreview={handleSelectPreview} onDeleteFile={handleDeleteFile} onDeleteSelected={() => setShowDeleteConfirm(true)} hasProtectedDirs={protectedDirs.size > 0} deleting={deleting} deleteProgress={deleteProgress} onNewScan={handleNewScan} filter={filter} onFilterChange={setFilter} />
                </div>
                <div
                  style={{
                    width: previewPath ? previewWidth : 0,
                    flexShrink: 0,
                    overflow: 'hidden',
                    transition: isDragging.current ? 'none' : 'width 0.25s ease',
                    position: 'relative',
                  }}
                  onTransitionEnd={handlePreviewTransitionEnd}
                >
                  {displayedPreviewPath && (
                    <>
                      <div
                        onMouseDown={handleResizeStart}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: 5,
                          height: '100%',
                          cursor: 'col-resize',
                          zIndex: 10,
                        }}
                      />
                      <PreviewPanel filePath={displayedPreviewPath} onClose={() => setPreviewPath(null)} isOpen={!!previewPath} width={previewWidth} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Delete confirmation modal */}
          <Modal
            opened={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            title="Confirm Deletion"
            centered
          >
            <Stack>
              <Text>
                Move <strong>{unusedPaths.size}</strong> {unusedPaths.size === 1 ? 'file' : 'files'} to the trash?
              </Text>
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleDeleteSelected}>Delete</Button>
              </Group>
            </Stack>
          </Modal>

          {/* Settings modal */}
          <SettingsModal
            opened={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSave={handleSaveSettings}
          />

          <Modal
            opened={showUpdateModal}
            onClose={() => setShowUpdateModal(false)}
            title="Update Ready"
            centered
          >
            <Text size="sm" mb="md">
              A new version of Prunr has been downloaded and is ready to install.
              Would you like to restart the application now?
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setShowUpdateModal(false)}>
                Later
              </Button>
              <Button onClick={() => window.api.installUpdate()}>
                Restart and Install
              </Button>
            </Group>
          </Modal>

          {/* Deletion progress modal */}
          <Modal
            opened={deleting}
            onClose={() => {}}
            title="Deleting files…"
            centered
            closeOnClickOutside={false}
            closeOnEscape={false}
            withCloseButton={false}
          >
            <Stack>
              <Text size="sm">{deleteProgress.done} / {deleteProgress.total} files deleted</Text>
              <Group gap="xs" wrap="nowrap">
                <Progress value={deleteProgress.total > 0 ? (deleteProgress.done / deleteProgress.total) * 100 : 0} animated style={{ flex: 1 }} />
                <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => { deleteAbort.current = true; }}>
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Stack>
          </Modal>
        </Stack>
        {dragOver && (
          <Overlay backgroundOpacity={0.5} blur={5} zIndex={9999} center>
            <Text fw={700} c="brown.2">Drop folders here</Text>
          </Overlay>
        )}
      </AppShell>
    </MantineProvider>
  );
}
