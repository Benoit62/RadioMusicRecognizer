Software for identifying last played song on a different radio stream.

It can listen to different stream, and event can be triggered based on different rules (3 (or more) specific last song, in order, from artist, )

## Installation

Clone this project
```bash
git clone https://github.com/Benoit62/RadioMusicRecognizer.git
```

Install all dependencies
```bash
npm install
```

Build the project
```bash
npm run build
```


## Usage

Add different stream you want to analyze in `rules` following the example.
Add attributes depending on the rules you ant to build.

Run the analyze with
```bash
npm run start
```



## Documentation

This application rely on different APIs for music identification.
Lot of them are configured to handle with price limitation and extend request number.

However, if a premium plan is subscribed to one of them, the application could rely on it.

The application make a request at least every 60 seconds (1 minute) (or more).

```math
1 * 60 * 24 = 1440 request / day
```
```math
1440 * 30 = 43 200 request / month
```

Choose one of theses providers (no matter which plan), configure if necessary and add the corresponding credentials in the .env

- AudD : https://dashboard.audd.io/
- Shazam RapidAPI : https://rapidapi.com/dashydata-dashydata-default/api/shazam-song-recognition-api
- ARC Cloud : https://console.acrcloud.com/avr?region=eu-west-1#/projects/online

Shazam is used by default, go into `src/RadioListener.ts` at line 198.
Uncomment the service you want to use and comment the other.
```typescript
const recognizedSong = await this.shazamMusicRecognizer.recognizeSong(sample.filePath);
if (recognizedSong) {
    this.handleRecognizedSong(recognizedSong);
}

/*const recognizedSongV2 = await this.arcMusicRecognizer.recognizeSong(sample.filePath);
if(recognizedSongV2) {
    this.handleRecognizedSong(recognizedSongV2);
}

const recognizedSongV3 = await this.auddMusicRecognizer.recognizeSong(sample.filePath);
if(recognizedSongV3) {
    this.handleRecognizedSong(recognizedSongV3);
}*/
```
Multiple can be used.


## Usage
Depending on the configuration, the application will sample and detect radio(s) current music at different intervals.
With enought frequency, this can provide a comprehensive list of played song on the radio.

The application allow to configure detection and associate rules set to trigger event depending on the rules.

### Radio streams
You can provide as must radio stream as you want.
Every stream added increase the API usages
```math
usage = frequency * streams

1440 request / day * 2 streams = 2880 request / day = 86 400 request / month
```

### Rules


## Improvements

- Automatic configuration of the API used (file/endpoint/command param)
- Better handling API responses based on their schema
- Automatic API overflow detection and switching
- Visual interface for rule creation
- Visual interface for configuration (streams/rules/APIs)
- More rules

