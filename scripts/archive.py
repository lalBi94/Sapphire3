import argparse
import tarfile
import zipfile
from pathlib import Path


# Parcourt récursivement le contenu d'un dossier, dans un ordre stable.
def iter_entries(source):
    for path in sorted(source.rglob('*'), key=lambda item: item.as_posix()):
        yield path


# Construit le nom d'une entrée dans l'archive, avec un préfixe facultatif.
def archive_name(relative, prefix):
    return f"{prefix.rstrip('/')}/{relative}" if prefix else relative


# Crée une archive ZIP en conservant les permissions Unix utiles.
def write_zip(source, output, prefix, executable, executable_mode, file_mode, dir_mode):
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in iter_entries(source):
            relative = path.relative_to(source).as_posix()
            name = archive_name(relative, prefix)
            if path.is_dir():
                info = zipfile.ZipInfo(f"{name}/")
                info.external_attr = ((dir_mode & 0xFFFF) << 16) | 0x10
                archive.writestr(info, b'')
                continue
            info = zipfile.ZipInfo(name)
            mode = executable_mode if executable and relative == executable else file_mode
            info.external_attr = (mode & 0xFFFF) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            with path.open('rb') as stream:
                archive.writestr(info, stream.read())


# Crée une archive tar.gz en conservant les permissions Unix utiles.
def write_tar(source, output, prefix, executable, executable_mode, file_mode, dir_mode):
    with tarfile.open(output, 'w:gz') as archive:
        for path in iter_entries(source):
            relative = path.relative_to(source).as_posix()
            name = archive_name(relative, prefix)
            info = archive.gettarinfo(str(path), arcname=name)
            info.uid = 0
            info.gid = 0
            info.uname = ''
            info.gname = ''
            if path.is_dir():
                info.mode = dir_mode
                archive.addfile(info)
                continue
            info.mode = executable_mode if executable and relative == executable else file_mode
            with path.open('rb') as stream:
                archive.addfile(info, stream)


def main():
    parser = argparse.ArgumentParser(description='Crée une archive portable avec permissions Unix.')
    parser.add_argument('--format', choices=['zip', 'tar.gz'], required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--prefix', default='')
    parser.add_argument('--executable', default='')
    parser.add_argument('--executable-mode', default='755')
    parser.add_argument('--file-mode', default='644')
    parser.add_argument('--dir-mode', default='755')
    args = parser.parse_args()

    source = Path(args.source)
    output = Path(args.output)
    if not source.is_dir():
        raise SystemExit(f'Dossier source absent : {source}')
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    executable_mode = int(args.executable_mode, 8)
    file_mode = int(args.file_mode, 8)
    dir_mode = int(args.dir_mode, 8)
    if args.format == 'zip':
        write_zip(source, output, args.prefix, args.executable, executable_mode, file_mode, dir_mode)
    else:
        write_tar(source, output, args.prefix, args.executable, executable_mode, file_mode, dir_mode)


if __name__ == '__main__':
    main()
