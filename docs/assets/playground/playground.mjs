class Playground
{
   autoUpdate = true;
   changed    = false;

   constructor ()
   {
      // Also change version in playground.html!
      require .config ({ paths: { "vs": "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" }});
      require (["vs/editor/editor.main"], () => this .setup ());
   }

   async setup ()
   {
      // Handle color scheme changes.
      // Must be done at first.

      window .matchMedia ("(prefers-color-scheme: dark)")
         .addEventListener ("change", () => this .changeColorScheme ());

      this .changeColorScheme ();

      // Create editor.

      const
         browser = X3D .getBrowser (),
         editor  = monaco .editor .create (document .getElementById ("editor"),
         {
            language: "xml",
            contextmenu: true,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            wrappingIndent: "indent",
            minimap: { enabled: false },
            bracketPairColorization: { enabled: true },
         });

      this .browser = browser;
      this .canvas  = $(browser .element);
      this .editor  = editor;

      browser .getContextMenu () .setUserMenu (() => this .updateUserMenu ());

      await browser .loadComponents (browser .getProfile ("Full"), browser .getComponent ("X_ITE"));

      this .addVRMLEncoding ();
      this .updateToolbar ();

      // Handle url parameter.

      const url = new URL (location) .searchParams .get ("url")
         ?? "/x_ite/assets/playground/playground.x3d";

      browser .baseURL = url;

      browser .endUpdate ();

      await browser .loadURL (new X3D .MFString (url)) .catch (Function .prototype);

      const encoding = { XML: "XML", JSON: "JSON", VRML: "VRML" } [browser .currentScene .encoding] ?? "XML";

      monaco .editor .setModelLanguage (editor .getModel (), encoding .toLowerCase ());

      this .updateLanguage (encoding);

      editor .setValue (browser .currentScene [`to${encoding}String`] ());
      editor .getModel () .onDidChangeContent (event => this .onDidChangeContent (event));

      browser .beginUpdate ();

      // Keyboard shortcuts.

      $("#editor") .on ("keydown", event => this .onKeyDown (event));
   }

   changeColorScheme ()
   {
      const darkMode = (window .matchMedia ?.("(prefers-color-scheme: dark)") .matches || $("html") .attr ("data-mode") === "dark") && ($("html") .attr ("data-mode") !== "light");

      monaco .editor .setTheme (darkMode ? "vs-dark" : "vs-light");
   }

   timeoutId;

   onDidChangeContent (event)
   {
      if (event .isFlush)
         return;

      this .changed = true;

      $("#refresh-button") .addClass ("selected");

      if (!this .autoUpdate)
         return;

      clearTimeout (this .timeoutId);

      this .timeoutId = setTimeout (() => this .applyChanges (), 1000);
   }

   onKeyDown (event)
   {
      // Apply changes when CommandOrCtrl-s is pressed.

      if (!(event .key === "s" && (event .ctrlKey || event .metaKey)))
         return;

      event .preventDefault ();
      this .applyChanges ();
   }

   openFile (input)
   {
      const file = input .prop ("files") [0];

      if (!file)
         return;

      const fileReader = new FileReader ();

      fileReader .addEventListener ("load", async () =>
      {
         await this .browser .loadURL (new X3D .MFString (fileReader .result)) .catch (Function .prototype);

         this .editor .setValue (this .browser .currentScene .toXMLString ());
         monaco .editor .setModelLanguage (this .editor .getModel (), "xml");
         this .updateLanguage ("XML");
      });

      fileReader .readAsDataURL (file);
   }

   async applyChanges ()
   {
      const
         browser         = this .browser,
         editor          = this .editor,
         activeViewpoint = browser .getActiveViewpoint (),
         text            = editor .getValue (),
         url             = encodeURI (`data:,${text}`);

      $("#refresh-button") .addClass ("selected");

      if (activeViewpoint)
      {
         var
            positionOffset    = activeViewpoint ._positionOffset    .copy (),
            orientationOffset = activeViewpoint ._orientationOffset .copy ();
      }

      await browser .loadURL (new X3D .MFString (url)) .catch (Function .prototype);

      if (activeViewpoint && browser .getActiveViewpoint ())
      {
         browser .getActiveViewpoint () ._positionOffset    = positionOffset;
         browser .getActiveViewpoint () ._orientationOffset = orientationOffset;
      }

      monaco .editor .setModelLanguage (editor .getModel (), browser .currentScene .encoding .toLowerCase ());

      this .changed = false;

      $("#refresh-button") .removeClass ("selected");
      this .updateLanguage (browser .currentScene .encoding);
   }

   updateToolbar ()
   {
      const
         browser = this .browser,
         editor  = this .editor,
         toolbar = $(".playground .toolbar");

      toolbar .empty ();

      const suffixes = [
         ".x3d",
         ".x3dz",
         ".x3dj",
         ".x3djz",
         ".x3dv",
         ".x3dvz",
         ".wrl",
         ".wrz",
         ".vrml",
         ".gltf",
         ".glb",
         ".obj",
         ".stl",
         ".ply",
         ".svg",
         ".svgz",
      ];

      const openFile = $("<input></input>")
         .attr ("type", "file")
         .attr ("accept", suffixes .join (","))
         .css ({ "position": "absolute", "visibility": "hidden" })
         .on ("change", () =>
         {
            this .openFile (openFile);
         })
         .appendTo (toolbar);

      $("<button></button>")
         .attr ("title", "Open a file (X3D, VRML, glTF (GLB), OBJ, STL, PLY, SVG).")
         .addClass (["fa-solid", "fa-file-pen"])
         .on ("click", () =>
         {
            openFile .trigger ("click");
         })
         .appendTo (toolbar);

      $("<span></span>") .addClass ("dot") .appendTo (toolbar);

      const autoUpdateButton = $("<button></button>")
         .addClass (this .autoUpdate ? "selected" : "")
         .append ($("<i></i>")
            .addClass (["icon", "fa-solid"])
            .addClass (this .autoUpdate ? "fa-check" : "fa-xmark"))
         .append ($("<span></span>")
            .addClass ("label")
            .text ("Auto Update"))
         .on ("click", () =>
         {
            this .autoUpdate = !this .autoUpdate;

            if (this .autoUpdate && this .changed)
               this .applyChanges ();

            autoUpdateButton
               .removeClass ("selected")
               .addClass (this .autoUpdate ? "selected" : "");

            autoUpdateButton .find (".icon")
               .removeClass (["fa-check", "fa-xmark"])
               .addClass (this .autoUpdate ? "fa-check" : "fa-xmark");
         })
         .appendTo (toolbar);

      $("<button></button>")
         .attr ("title", "Apply changes.")
         .attr ("id", "refresh-button")
         .addClass (["fa-solid", "fa-arrows-rotate"])
         .on ("click", () =>
         {
            this .applyChanges ();
         })
         .appendTo (toolbar);

      $("<span></span>") .addClass ("dot") .appendTo (toolbar);

      const playButton = $("<button></button>")
         .attr ("title", "Toggle browser update on/off.")
         .addClass (["fa-solid", "fa-play"])
         .addClass (browser .isLive () ? "selected" : "")
         .on ("click", () =>
         {
            if (browser .isLive ())
               browser .endUpdate ();
            else
               browser .beginUpdate ();
         })
         .appendTo (toolbar);

      browser .getLive () .addFieldCallback ("playground", () =>
      {
         playButton
            .removeClass ("selected")
            .addClass (browser .isLive () ? "selected" : "");
      });

      $("<span></span>") .addClass ("dot") .appendTo (toolbar);

      $("<button></button>")
         .attr ("title", "View all objects in scene.")
         .addClass (["fa-solid", "fa-arrows-to-dot"])
         .on ("click", () =>
         {
            browser .viewAll ();
         })
         .appendTo (toolbar);

      // Right side

      const right = $("<div></div>")
         .css ("float", "right")
         .appendTo (toolbar);

      $("<button></button>")
         .addClass (["language", "XML"])
         .addClass (browser .currentScene .encoding === "XML" ? "selected" : "")
         .attr ("title", "Convert to X3D XML Encoding.")
         .text ("XML")
         .on ("click", () =>
         {
            editor .setValue (browser .currentScene .toXMLString ());
            monaco .editor .setModelLanguage (editor .getModel (), "xml");
            this .updateLanguage ("XML");
         })
         .appendTo (right);

      $("<span></span>") .addClass ("dot") .appendTo (right);

      $("<button></button>")
         .addClass (["language", "VRML"])
         .addClass (browser .currentScene .encoding === "VRML" ? "selected" : "")
         .attr ("title", "Convert to X3D VRML Encoding.")
         .text ("VRML")
         .on ("click", () =>
         {
            editor .setValue (browser .currentScene .toVRMLString ());
            monaco .editor .setModelLanguage (editor .getModel (), "vrml");
            this .updateLanguage ("VRML");
         })
         .appendTo (right);

      $("<span></span>") .addClass ("dot") .appendTo (right);

      $("<button></button>")
         .addClass (["language", "JSON"])
         .addClass (browser .currentScene .encoding === "JSON" ? "selected" : "")
         .attr ("title", "Convert to X3D JSON Encoding.")
         .text ("JSON")
         .on ("click", () =>
         {
            editor .setValue (browser .currentScene .toJSONString ());
            monaco .editor .setModelLanguage (editor .getModel (), "json");
            this .updateLanguage ("JSON");
         })
         .appendTo (right);
   }

   updateLanguage (encoding)
   {
      $(".language") .removeClass ("selected");
      $(`.language.${encoding}`) .addClass ("selected");
   }

   pixelated = false;

   updateUserMenu ()
   {
      const
         browser = this .browser,
         canvas  = this .canvas;

      return {
         "antialiased": {
            name: "Antialiased",
            type: "checkbox",
            selected: browser .getBrowserOption ("Antialiased"),
            events: {
               click ()
               {
                  canvas .attr ("antialiased", !browser .getBrowserOption ("Antialiased"));
               },
            },
         },
         "pixelated": {
            name: "Pixelated",
            type: "checkbox",
            selected: this .pixelated,
            events: {
               click: () =>
               {
                  this .pixelated = !this .pixelated;

                  canvas .css ("image-rendering", this .pixelated ? "pixelated" : "unset");
               },
            },
         },
         "content-scale": {
            name: "Content Scale",
            items: {
               radio1: {
                  name: "0.1",
                  type: "radio",
                  radio: "content-scale",
                  selected: browser .getBrowserOption ("ContentScale") === 0.1,
                  value: "0.1",
                  events: {
                     click () { canvas .attr ("contentScale", "0.1"); },
                  },
               },
               radio2: {
                  name: "1",
                  type: "radio",
                  radio: "content-scale",
                  selected: browser .getBrowserOption ("ContentScale") === 1,
                  value: "1",
                  events: {
                     click () { canvas .attr ("contentScale", "1"); },
                  },
               },
               radio3: {
                  name: "2",
                  type: "radio",
                  radio: "content-scale",
                  selected: browser .getBrowserOption ("ContentScale") === 2,
                  value: "2",
                  events: {
                     click () { canvas .attr ("contentScale", "2"); },
                  },
               },
               radio4: {
                  name: "Auto",
                  type: "radio",
                  radio: "content-scale",
                  selected: browser .getBrowserOption ("ContentScale") === -1,
                  value: "auto",
                  events: {
                     click () { canvas .attr ("contentScale", "auto"); },
                  },
               },
            },
         },
         "separator0": "--------",
         "oit": {
            name: "Order Independent Transparency",
            type: "checkbox",
            selected: browser .getBrowserOption ("OrderIndependentTransparency"),
            events: {
               click ()
               {
                  canvas .attr ("orderIndependentTransparency", !browser .getBrowserOption ("OrderIndependentTransparency"));
               },
            },
         },
         "log": {
            name: "Logarithmic Depth Buffer",
            type: "checkbox",
            selected: browser .getBrowserOption ("LogarithmicDepthBuffer"),
            events: {
               click ()
               {
                  canvas .attr ("logarithmicDepthBuffer", !browser .getBrowserOption ("LogarithmicDepthBuffer"));
               },
            },
         },
      };
   }

   addVRMLEncoding ()
   {
      const browser = this .browser;

      monaco .languages .setMonarchTokensProvider ("vrml",
      {
         defaultToken: "invalid",
         tokenPostfix: ".vrml",
         keywords: [
            "PROFILE", "COMPONENT", "UNIT", "META", "DEF", "USE", "EXTERNPROTO", "PROTO", "IS", "ROUTE", "TO", "IMPORT", "EXPORT", "AS",
         ],
         profiles: Array .from (browser .supportedProfiles, ({name}) => name),
         components: Array .from (browser .supportedComponents, ({name}) => name),
         nodes: Array .from (browser .concreteNodes, ({typeName}) => typeName),
         accessTypes: [
            // X3D
            "initializeOnly", "inputOnly", "outputOnly", "inputOutput",
            // VRML
            "field", "eventIn", "eventOut", "exposedField",
         ],
         // fieldTypes: Array .from (browser .fieldTypes, ({typeName}) => typeName),
         fieldTypes: [
            "SFBool", "SFColor", "SFColorRGBA", "SFDouble", "SFFloat", "SFImage", "SFInt32", "SFMatrix3d", "SFMatrix3f", "SFMatrix4d", "SFMatrix4f", "SFNode", "SFRotation", "SFString", "SFTime", "SFVec2d", "SFVec2f", "SFVec3d", "SFVec3f", "SFVec4d", "SFVec4f", "MFBool", "MFColor", "MFColorRGBA", "MFDouble", "MFFloat", "MFImage", "MFInt32", "MFMatrix3d", "MFMatrix3f", "MFMatrix4d", "MFMatrix4f", "MFNode", "MFRotation", "MFString", "MFVec2d", "MFVec2f", "MFVec3d", "MFVec3f", "MFVec4d", "MFVec4f",
         ],
         id: /[^\x30-\x39\x00-\x20\x22\x23\x27\x2b\x2c\x2d\x2e\x5b\x5c\x5d\x7b\x7d\x7f]{1}[^\x00-\x20\x22\x23\x27\x2c\x2e\x5b\x5c\x5d\x7b\x7d\x7f]*/,
         escapes: /\\(?:[abfnrtv\\"'`]|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
         tokenizer: {
            root: [
               [/[,:.]/, "delimiter"],
               [/TRUE|FALSE|NULL/, "constant"],
               [/PROTO|EXTERNPROTO/, "regexp", "@typeName"],
               [/DEF|USE|AS|ROUTE|TO|EXPORT/, "regexp", "@name"],
               [/(IMPORT)(\s+)(@id)(\s*)(\.)(\s*)(@id)/, ["regexp", "", "type.identifier", "", "delimiter", "", "type.identifier"]],
               [/@id(?=\s*\{)/, "keyword"], // type names
               [/@id/, {
                  cases: {
                     "@keywords": "regexp",
                     "@profiles": "keyword",
                     "@components": "keyword",
                     "@nodes": "keyword",
                     "@accessTypes": "regexp",
                     "@fieldTypes": "type.identifier",
                     "@default": "attribute.name", // field names
                  },
               }],
               [/#.*/, "comment"],
               [/[{}\[\]]/, "@brackets"],
               [/[+-]?(?:(?:(?:\d*\.\d+)|(?:\d+(?:\.)?))(?:[eE][+-]?\d+)?)/, "number.float"],
               [/0[xX][\da-fA-F]+/, "number.hex"],
               [/[+-]?\d+/, "number"],
               [/"/,  { token: "string.quote", bracket: "@open", next: "@string" } ],
            ],
            typeName: [
               [/@id/, "keyword", "@pop"],
            ],
            name: [
               [/@id/, "type.identifier", "@pop"],
            ],
            string: [
               [/[^\\"]+/,  "string"],
               [/@escapes/, "string.escape"],
               [/\\./,      "string.escape.invalid"],
               [/"/,        { token: "string.quote", bracket: "@close", next: "@pop" } ]
            ],
         },
      });

      monaco .languages .register ({
         id: "vrml",
         extensions: [".x3dv"],
         aliases: ["VRML"],
         mimetypes: ["model/x3d+vrml"],
      });

      monaco .languages .setLanguageConfiguration ("vrml",
      {
         brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
         autoClosingPairs: [
         { open: "{", close: "}" },
         { open: "[", close: "]" },
         { open: "(", close: ")" },
         { open: "\"", close: "\"" },
         { open: "'", close: "'" },
         ],
      });
   }
}

const playground = new Playground ();

(() =>
{
   function output (log, classes)
   {
      let c;

      return function (... args)
      {
         const
            text     = args .join ("") + "\n",
            element  = $("<span></span>") .addClass (classes) .text (text),
            console  = c ??= $(".console"),
            children = console .children ();

         if (text .match (/No suitable|of an UNKNOWN touch/))
            return;

         log .apply (this, args);

         children .slice (0, Math .max (children .length - 200, 0)) .remove ();

         console .append (element);
         console .scrollTop (console .prop ("scrollHeight"));
      }
   }

   console .log   = output (console .log,   "log");
   console .info  = output (console .info,  ["info", "blue"]);
   console .warn  = output (console .warn,  ["warn", "yellow"]);
   console .error = output (console .error, ["error", "red"]);
   console .debug = output (console .debug, "debug");

   console .info (X3D .getBrowser () .getWelcomeMessage ());
})();
